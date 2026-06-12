import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, Spinner, Stack, Text } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryList } from '../hooks/useRepositoryList';

import { FoldersToMigrate } from './FoldersToMigrate';
import { MigrateDrawer } from './MigrateDrawer';
import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';
import { OverviewStatCards } from './OverviewStatCards';
import { useFolderMigrationData } from './hooks/useFolderMigrationData';
import { resolveSelection } from './selection';
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
  const { data: folders, isLoading: isFoldersLoading, isError: isFoldersError } = useFolderMigrationData();
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

  if (isLoading || isFoldersLoading) {
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

  const unmanagedTotal =
    Math.max(0, totals.instanceTotal - totals.managed) + Math.max(0, folderCounts.total - folderCounts.managed);
  const hasRepo = (repos ?? []).length > 0;

  const closeDrawer = () => setDrawerScope(null);
  const clearSelection = () => {
    setSelectedFolderUids(new Set());
    setSelectedDashboardUids(new Set());
  };

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards totals={totals} folderCounts={folderCounts} />

      {unmanagedTotal > 0 ? (
        <Stack direction="row" justifyContent="flex-start">
          <Button variant="primary" onClick={() => setDrawerScope('all')}>
            <Trans i18nKey="provisioning.migrate.start-button">Start migration</Trans>
          </Button>
        </Stack>
      ) : (
        <Text color="secondary">
          <Trans i18nKey="provisioning.migrate.all-managed">
            All of your dashboards and folders are already managed in Git.
          </Trans>
        </Text>
      )}

      {isFoldersError ? (
        <Alert
          severity="warning"
          title={t('provisioning.migrate.folders-error-title', 'Could not load the list of folders to migrate')}
        >
          <Trans i18nKey="provisioning.migrate.folders-error-body">
            The overview above is still accurate. Refresh the page to try loading the folder list again.
          </Trans>
        </Alert>
      ) : (
        <FoldersToMigrate
          folders={folders}
          selectedFolderUids={selectedFolderUids}
          selectedDashboardUids={selectedDashboardUids}
          onToggleFolder={(uid) => setSelectedFolderUids((prev) => toggle(prev, uid))}
          onToggleDashboard={(uid) => setSelectedDashboardUids((prev) => toggle(prev, uid))}
          selectedCount={selection.items}
          onMigrateSelected={() => setDrawerScope('selected')}
          migrateDisabled={!hasRepo}
          migrateTooltip={t(
            'provisioning.migrate.dashboards-to-migrate-no-repo-tooltip',
            'Connect a repository before migrating.'
          )}
        />
      )}

      {drawerScope && (
        <MigrateDrawer
          repos={repos ?? []}
          resources={drawerScope === 'selected' ? selection.resources : undefined}
          selection={
            drawerScope === 'selected' ? { folders: selection.folders, dashboards: selection.dashboards } : undefined
          }
          onDismiss={closeDrawer}
          onMigrated={() => {
            refetch();
            clearSelection();
          }}
        />
      )}
    </Stack>
  );
}
