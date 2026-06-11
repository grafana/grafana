import { useMemo, useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, Button, EmptyState, Spinner, Stack, Text } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRepositoryList } from '../hooks/useRepositoryList';

import { MigrateDrawer } from './MigrateDrawer';
import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';
import { OverviewStatCards } from './OverviewStatCards';
import { aggregateDashboardTotals, aggregateFolderCounts, computeBreakdowns } from './stats';

/**
 * Migrate to GitOps tab. Shows an overview of how much of the instance is
 * already managed and, when there are still unmanaged dashboards or folders,
 * lets the user run a migration. The migration itself happens in a drawer
 * (consistent with other provisioning jobs) where the target repository is
 * selected and the job's progress and result are shown. Per-resource selection
 * lands in a follow-up.
 */
export function Migrate() {
  const { data, isLoading, isError, error, refetch } = useGetResourceStatsQuery();
  const [repos] = useRepositoryList({ watch: true });
  const [showDrawer, setShowDrawer] = useState(false);

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateDashboardTotals(breakdowns), [breakdowns]);
  const folderCounts = useMemo(() => aggregateFolderCounts(breakdowns), [breakdowns]);

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

  const unmanagedTotal =
    Math.max(0, totals.instanceTotal - totals.managed) + Math.max(0, folderCounts.total - folderCounts.managed);

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards totals={totals} folderCounts={folderCounts} />

      {unmanagedTotal > 0 ? (
        <Stack direction="column" gap={1} alignItems="flex-start">
          <Button variant="primary" onClick={() => setShowDrawer(true)}>
            <Trans i18nKey="provisioning.migrate.start-button">Start migration</Trans>
          </Button>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.migrate.selective-coming-soon">
              Migrating only selected dashboards and folders is coming soon.
            </Trans>
          </Text>
        </Stack>
      ) : (
        <Text color="secondary">
          <Trans i18nKey="provisioning.migrate.all-managed">
            All of your dashboards and folders are already managed in Git.
          </Trans>
        </Text>
      )}

      {showDrawer && (
        <MigrateDrawer repos={repos ?? []} onDismiss={() => setShowDrawer(false)} onMigrated={() => refetch()} />
      )}
    </Stack>
  );
}
