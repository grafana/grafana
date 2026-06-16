import { useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, Stack } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';
import { MigrationGuideNote } from './MigrationGuideNote';
import { OverviewStatCards } from './OverviewStatCards';
import { aggregateDashboardTotals, aggregateFolderCounts, computeBreakdowns } from './stats';

/**
 * Migrate to GitOps tab. Shows an overview of how much of the instance is
 * already managed and how much progress has been made toward GitOps. The
 * interactive migration workflow (folder leaderboard, quick wins, the migrate
 * drawer) lands in follow-up changes.
 */
export function Migrate() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();

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

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards totals={totals} folderCounts={folderCounts} />
      <MigrationGuideNote />
    </Stack>
  );
}
