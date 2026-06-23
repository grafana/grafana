import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, Spinner, Stack } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetFrontendSettingsQuery, useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';
import { useRepositoryList } from '../hooks/useRepositoryList';
import { isResourceKindAvailable, resourceKindInfos } from '../utils/resourceKinds';

import { MigrateDrawer } from './MigrateDrawer';
import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';
import { OverviewStatCards } from './OverviewStatCards';
import { ResourcesToMigrate } from './ResourcesToMigrate';
import { useFolderMigrationData } from './hooks/useFolderMigrationData';
import { usePlaylistMigrationData } from './hooks/usePlaylistMigrationData';
import { resolveSelection } from './selection';
import { aggregateDashboardTotals, aggregateFolderCounts, aggregatePlaylistTotals, computeBreakdowns } from './stats';

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
  // Playlists only appear when the backend declares the kind enabled for
  // provisioning. Otherwise we never fetch, count, or surface them. Gate
  // strictly on `availableResources` being populated — `isResourceKindAvailable`
  // falls back to the full registry when it's missing (e.g. settings not loaded
  // yet), which we must not treat as "enabled" here.
  const availableResources = settings?.availableResources;
  const playlistsEnabled =
    Boolean(availableResources) && isResourceKindAvailable(resourceKindInfos.playlist, availableResources);

  const {
    data: folders,
    isLoading: isFoldersLoading,
    isError: isFoldersError,
    refetch: refetchFolders,
  } = useFolderMigrationData();
  const {
    data: playlists,
    isLoading: isPlaylistsLoading,
    refetch: refetchPlaylists,
  } = usePlaylistMigrationData(playlistsEnabled);
  const [repos] = useRepositoryList({ watch: true });
  const [drawerScope, setDrawerScope] = useState<DrawerScope | null>(null);
  const [selectedFolderUids, setSelectedFolderUids] = useState<Set<string>>(new Set());
  const [selectedDashboardUids, setSelectedDashboardUids] = useState<Set<string>>(new Set());
  const [selectedPlaylistUids, setSelectedPlaylistUids] = useState<Set<string>>(new Set());

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateDashboardTotals(breakdowns), [breakdowns]);
  const playlistTotals = useMemo(() => aggregatePlaylistTotals(breakdowns), [breakdowns]);
  const folderCounts = useMemo(() => aggregateFolderCounts(breakdowns), [breakdowns]);
  const selection = useMemo(
    () => resolveSelection(folders, selectedFolderUids, selectedDashboardUids, selectedPlaylistUids),
    [folders, selectedFolderUids, selectedDashboardUids, selectedPlaylistUids]
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

  if (totals.instanceTotal === 0 && folderCounts.total === 0 && playlistTotals.instanceTotal === 0) {
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
  // `allSelected` reflects whether every migratable resource in the table is
  // picked (drives the "Migrate all" → migrate-everything path). It spans both
  // folders and playlists. The select-all checkbox itself is scoped to the
  // search-filtered rows inside the table.
  const hasMigratableRows = folders.length > 0 || playlists.length > 0;
  const allSelected =
    hasMigratableRows &&
    folders.every((folder) => selectedFolderUids.has(folder.uid)) &&
    playlists.every((playlist) => selectedPlaylistUids.has(playlist.uid));
  // "Migrate all" runs the legacy migrate-everything job; a partial selection
  // needs at least one resolved resource ref to send.
  const canSubmit = allSelected ? hasMigratableRows : selection.resources.length > 0;
  // Stats-derived: is there anything unmanaged at all? Used for the
  // migrate-everything fallback when the folder list itself can't be loaded —
  // that job is stats-driven and doesn't need the per-folder enumeration.
  const hasUnmanaged =
    Math.max(0, totals.instanceTotal - totals.managed) +
      Math.max(0, folderCounts.total - folderCounts.managed) +
      Math.max(0, playlistTotals.instanceTotal - playlistTotals.managed) >
    0;

  const closeDrawer = () => setDrawerScope(null);
  const clearSelection = () => {
    setSelectedFolderUids(new Set());
    setSelectedDashboardUids(new Set());
    setSelectedPlaylistUids(new Set());
  };
  const setFoldersSelected = (uids: string[], selected: boolean) => {
    setSelectedFolderUids((prev) => {
      const next = new Set(prev);
      uids.forEach((uid) => (selected ? next.add(uid) : next.delete(uid)));
      return next;
    });
  };
  const setPlaylistsSelected = (uids: string[], selected: boolean) => {
    setSelectedPlaylistUids((prev) => {
      const next = new Set(prev);
      uids.forEach((uid) => (selected ? next.add(uid) : next.delete(uid)));
      return next;
    });
  };

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards dashboards={totals} playlists={playlistsEnabled ? playlistTotals : undefined} />

      {isFoldersLoading || isPlaylistsLoading ? (
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
          playlists={playlists}
          selectedPlaylistUids={selectedPlaylistUids}
          onTogglePlaylist={(uid) => setSelectedPlaylistUids((prev) => toggle(prev, uid))}
          onSetPlaylistsSelected={setPlaylistsSelected}
          selectedCount={selection.items}
          allSelected={allSelected}
          onSetFoldersSelected={setFoldersSelected}
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
            drawerScope === 'selected'
              ? { folders: selection.folders, resources: selection.resources.length }
              : undefined
          }
          onDismiss={closeDrawer}
          onMigrated={() => {
            // Refresh the stat cards and the resource tables so migrated
            // resources drop out of the selectable rows.
            refetch();
            refetchFolders();
            refetchPlaylists();
            clearSelection();
          }}
        />
      )}
    </Stack>
  );
}
