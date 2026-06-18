import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, Spinner, Stack } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';
import { useRepositoryList } from '../hooks/useRepositoryList';

import { MigrateDrawer } from './MigrateDrawer';
import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';
import { OverviewStatCards } from './OverviewStatCards';
import { ResourcesToMigrate } from './ResourcesToMigrate';
import { useFolderMigrationData } from './hooks/useFolderMigrationData';
import { isMigratableFolder, resolveSelection } from './selection';
import { aggregateDashboardTotals, aggregateFolderCounts, computeBreakdowns } from './stats';

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
  const {
    data: folders,
    isLoading: isFoldersLoading,
    isError: isFoldersError,
    refetch: refetchFolders,
  } = useFolderMigrationData();
  const [repos] = useRepositoryList({ watch: true });
  const [drawerScope, setDrawerScope] = useState<DrawerScope | null>(null);
  const [selectedFolderUids, setSelectedFolderUids] = useState<Set<string>>(new Set());
  const [selectedDashboardUids, setSelectedDashboardUids] = useState<Set<string>>(new Set());

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateDashboardTotals(breakdowns), [breakdowns]);
  const folderCounts = useMemo(() => aggregateFolderCounts(breakdowns), [breakdowns]);
  const selection = useMemo(
    () => resolveSelection(folders, selectedFolderUids, selectedDashboardUids),
    [folders, selectedFolderUids, selectedDashboardUids]
  );

  // Gate only on the stats query — the header and KPI cards depend on it. The
  // folder/dashboard enumeration can be slow on large instances, so the table
  // carries its own loading state below instead of blocking the whole tab.
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

  if (totals.instanceTotal === 0 && folderCounts.total === 0) {
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
  // Select-all and the "migrate everything" affordance operate on the full set
  // of migratable folders, not just the search-filtered view.
  const migratableUids = folders.filter(isMigratableFolder).map((f) => f.uid);
  const allSelected = migratableUids.length > 0 && migratableUids.every((uid) => selectedFolderUids.has(uid));
  const someSelected = selection.items > 0;
  // "Migrate all" (everything) is valid whenever there are migratable folders;
  // a partial selection needs at least one resolved dashboard ref — picking
  // only empty folders resolves to nothing migratable, so don't allow it to
  // silently fall through to a migrate-everything.
  const canSubmit = allSelected ? migratableUids.length > 0 : selection.resources.length > 0;
  // Stats-derived: is there anything unmanaged at all? Used for the
  // migrate-everything fallback when the folder list itself can't be loaded —
  // that job is stats-driven and doesn't need the per-folder enumeration.
  const hasUnmanaged =
    Math.max(0, totals.instanceTotal - totals.managed) + Math.max(0, folderCounts.total - folderCounts.managed) > 0;

  const closeDrawer = () => setDrawerScope(null);
  const clearSelection = () => {
    setSelectedFolderUids(new Set());
    setSelectedDashboardUids(new Set());
  };
  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      // Selecting every folder covers every resource, so any individually
      // ticked resource is redundant — reset to the clean "all folders" state.
      setSelectedFolderUids(new Set(migratableUids));
      setSelectedDashboardUids(new Set());
    }
  };

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards totals={totals} folderCounts={folderCounts} />

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
          {/* Migrating everything is stats-driven and doesn't need the folder
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
        <ResourcesToMigrate
          folders={folders}
          selectedFolderUids={selectedFolderUids}
          selectedDashboardUids={selectedDashboardUids}
          onToggleFolder={(uid) => setSelectedFolderUids((prev) => toggle(prev, uid))}
          onToggleDashboard={(uid) => setSelectedDashboardUids((prev) => toggle(prev, uid))}
          selectedCount={selection.items}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleSelectAll={toggleSelectAll}
          // Selecting everything runs the legacy "migrate all unmanaged" job;
          // a partial selection scopes the job to the picked resources.
          onMigrateSelected={() => setDrawerScope(allSelected ? 'all' : 'selected')}
          submitDisabled={!canSubmit}
          canMigrate={hasWriteRepo}
          connectAction={<ConnectRepositoryButton items={repos ?? []} />}
        />
      )}

      {drawerScope && (
        <MigrateDrawer
          repos={repos ?? []}
          selective={drawerScope === 'selected'}
          resources={drawerScope === 'selected' ? selection.resources : undefined}
          selection={
            drawerScope === 'selected' ? { folders: selection.folders, dashboards: selection.dashboards } : undefined
          }
          onDismiss={closeDrawer}
          onMigrated={() => {
            // Refresh both the stat cards and the folder/dashboard table so
            // migrated resources drop out of the selectable rows.
            refetch();
            refetchFolders();
            clearSelection();
          }}
        />
      )}
    </Stack>
  );
}
