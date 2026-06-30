import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, Spinner, Stack } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetFrontendSettingsQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';
import { useRepositoryList } from '../hooks/useRepositoryList';
import { getMigratableKinds } from '../utils/resourceKinds';

import { MigrateDrawer } from './MigrateDrawer';
import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';
import { OverviewStatCards } from './OverviewStatCards';
import { ResourcesToMigrate } from './ResourcesToMigrate';
import { useMigrationData } from './hooks/useMigrationData';
import { resolveSelection } from './selection';
import { computeFolderCounts, computeKindTotals } from './stats';

type DrawerScope = 'all' | 'selected';

function toggle(set: Set<string>, uid: string): Set<string> {
  const next = new Set(set);
  if (next.has(uid)) {
    next.delete(uid);
  } else {
    next.add(uid);
  }
  return next;
}

export function Migrate() {
  const { data, isLoading, isError, error, refetch } = useGetResourceStatsQuery();
  const { data: settings } = useGetFrontendSettingsQuery();

  // The kinds to enumerate, count, and offer for migration are derived from the
  // backend's `availableResources` (plus the always-on base) so the page is
  // generic — a newly enabled kind flows through without per-kind wiring here.
  const availableResources = settings?.availableResources;
  const contentKinds = useMemo(() => getMigratableKinds(availableResources), [availableResources]);

  const {
    data: folders,
    isLoading: isFoldersLoading,
    isError: isFoldersError,
    failedKinds,
    refetch: refetchFolders,
  } = useMigrationData(contentKinds);
  const [repos] = useRepositoryList({ watch: true });
  const [drawerScope, setDrawerScope] = useState<DrawerScope | null>(null);
  const [selectedFolderUids, setSelectedFolderUids] = useState<Set<string>>(new Set());
  const [selectedResourceKeys, setSelectedResourceKeys] = useState<Set<string>>(new Set());

  const kindTotals = useMemo(() => computeKindTotals(data, contentKinds), [data, contentKinds]);
  const folderCounts = useMemo(() => computeFolderCounts(data), [data]);
  const selection = useMemo(
    () => resolveSelection(folders, selectedFolderUids, selectedResourceKeys),
    [folders, selectedFolderUids, selectedResourceKeys]
  );

  // Gate only on the stats query — the header and KPI cards depend on it. The
  // resource enumeration can be slow on large instances, so the table carries
  // its own loading state below instead of blocking the whole tab.
  if (isLoading) {
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <Spinner />
        <Trans i18nKey="provisioning.migrate.loading">Loading stats...</Trans>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" title={t('provisioning.migrate.error-title', 'Failed to load provisioning stats')}>
        {getErrorMessage(error)}
      </Alert>
    );
  }

  // Total instance resources across every migratable kind plus folders.
  const kindInstanceTotal = kindTotals.reduce((sum, { totals }) => sum + totals.instanceTotal, 0);
  if (kindInstanceTotal === 0 && folderCounts.total === 0) {
    return (
      <Stack direction="column" gap={3}>
        <MigrateToGitopsHeader />
        <EmptyState variant="not-found" message={t('provisioning.migrate.empty', 'No provisioned resources yet')} />
      </Stack>
    );
  }

  // Migration writes to a repository's configured branch, so it needs a repo
  // with the `write` workflow — matching the guard in the drawer. Without one,
  // the table footer surfaces a connect action instead of a dead button.
  const hasWriteRepo = (repos ?? []).some((repo) => repo.spec?.workflows?.includes('write'));
  // `allSelected` reflects whether every migratable folder in the table is
  // picked, including any synthetic per-kind folder. The select-all checkbox
  // itself is scoped to the search-filtered rows inside the table.
  const allSelected = folders.length > 0 && folders.every((folder) => selectedFolderUids.has(folder.uid));
  // Selecting everything escalates to the stats-driven migrate-everything job —
  // but only when the displayed list is COMPLETE. If a kind failed to enumerate
  // (failedKinds), the table is missing rows, so "select all" must stay a
  // selective migration of what's shown rather than silently migrating resources
  // the user never saw. The partial-failure warning offers an explicit
  // migrate-everything action instead.
  const listComplete = failedKinds.length === 0;
  const migrateAllUnmanaged = allSelected && listComplete;
  // The migrate-everything job is stats-driven (no refs); a selective migration
  // needs at least one resolved resource ref to send.
  const canSubmit = migrateAllUnmanaged ? folders.length > 0 : selection.resources.length > 0;
  // Stats-derived: is there anything unmanaged at all? Used for the
  // migrate-everything fallback when the resource list itself can't be loaded —
  // that job is stats-driven and doesn't need the per-folder enumeration.
  const unmanagedKinds = kindTotals.reduce(
    (sum, { totals }) => sum + Math.max(0, totals.instanceTotal - totals.managed),
    0
  );
  const hasUnmanaged = unmanagedKinds + Math.max(0, folderCounts.total - folderCounts.managed) > 0;

  const closeDrawer = () => setDrawerScope(null);
  const clearSelection = () => {
    setSelectedFolderUids(new Set());
    setSelectedResourceKeys(new Set());
  };
  const setFoldersSelected = (uids: string[], selected: boolean) => {
    setSelectedFolderUids((prev) => {
      const next = new Set(prev);
      uids.forEach((uid) => (selected ? next.add(uid) : next.delete(uid)));
      return next;
    });
  };

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards totals={kindTotals} />

      {isFoldersLoading ? (
        <Stack direction="row" alignItems="center" gap={1}>
          <Spinner />
          <Trans i18nKey="provisioning.migrate.loading-resources">Loading resources...</Trans>
        </Stack>
      ) : isFoldersError ? (
        <Stack direction="column" gap={2} alignItems="flex-start">
          <Alert
            severity="warning"
            title={t('provisioning.migrate.folders-error-title', 'Could not load the list of resources to migrate')}
          >
            <Trans i18nKey="provisioning.migrate.folders-error-body">
              The overview above is still accurate. You can still migrate everything now, or refresh the page to load
              the list and pick individual resources.
            </Trans>
          </Alert>
          {/* Migrating everything is stats-driven and doesn't need the resource
              list, so keep it reachable even when the list failed to load. */}
          {hasUnmanaged &&
            (hasWriteRepo ? (
              <Button variant="primary" icon="upload" onClick={() => setDrawerScope('all')}>
                <Trans i18nKey="provisioning.migrate.migrate-everything">Migrate everything</Trans>
              </Button>
            ) : (
              <ConnectRepositoryButton items={repos ?? []} />
            ))}
        </Stack>
      ) : (
        <Stack direction="column" gap={2}>
          {failedKinds.length > 0 && (
            <Alert
              severity="warning"
              title={t('provisioning.migrate.partial-error-title', 'Some resource types could not be loaded')}
            >
              <Stack direction="column" gap={1} alignItems="flex-start">
                {t(
                  'provisioning.migrate.partial-error-body',
                  "{{kinds}} aren't shown below, so this list is incomplete. Selecting everything here migrates only the resources listed; use Migrate everything to include all unmanaged resources, or refresh to load the full list.",
                  { kinds: failedKinds.map((kind) => kind.pluralLabel()).join(', ') }
                )}
                {hasUnmanaged &&
                  (hasWriteRepo ? (
                    <Button variant="secondary" icon="upload" onClick={() => setDrawerScope('all')}>
                      <Trans i18nKey="provisioning.migrate.migrate-everything">Migrate everything</Trans>
                    </Button>
                  ) : (
                    <ConnectRepositoryButton items={repos ?? []} />
                  ))}
              </Stack>
            </Alert>
          )}
          <ResourcesToMigrate
            folders={folders}
            selectedFolderUids={selectedFolderUids}
            selectedResourceKeys={selectedResourceKeys}
            onToggleFolder={(uid) => setSelectedFolderUids((prev) => toggle(prev, uid))}
            onToggleResource={(key) => setSelectedResourceKeys((prev) => toggle(prev, key))}
            selectedCount={selection.items}
            allSelected={migrateAllUnmanaged}
            onSetFoldersSelected={setFoldersSelected}
            // Selecting everything runs the legacy "migrate all unmanaged" job
            // only when the list is complete; otherwise it scopes to the picked
            // resources so an incomplete list never migrates un-shown kinds.
            onMigrateSelected={() => setDrawerScope(migrateAllUnmanaged ? 'all' : 'selected')}
            submitDisabled={!canSubmit}
            canMigrate={hasWriteRepo}
            connectAction={<ConnectRepositoryButton items={repos ?? []} />}
          />
        </Stack>
      )}

      {drawerScope && (
        <MigrateDrawer
          repos={repos ?? []}
          selective={drawerScope === 'selected'}
          resources={drawerScope === 'selected' ? selection.resources : undefined}
          selection={
            drawerScope === 'selected'
              ? { folders: selection.folders, resources: selection.resources.length }
              : undefined
          }
          onDismiss={closeDrawer}
          onMigrated={() => {
            // Refresh the stat cards and the resource table so migrated
            // resources drop out of the selectable rows.
            refetch();
            refetchFolders();
            clearSelection();
          }}
        />
      )}
    </Stack>
  );
}
