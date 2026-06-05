import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { CONFIGURE_GRAFANA_DOCS_URL } from '../constants';

import { MigrateToGitopsHeader } from './MigrateToGitopsHeader';
import { OverviewStatCards } from './OverviewStatCards';
import { aggregateFolderCounts, aggregateTotals, computeBreakdowns } from './stats';

function MigrationGuideNote() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.intro}>
      <Text color="secondary">
        <Trans i18nKey="provisioning.migrate.intro">
          The guided migration workflow is on its way. In the meantime, read the{' '}
          <TextLink external href={CONFIGURE_GRAFANA_DOCS_URL}>
            provisioning documentation
          </TextLink>{' '}
          to learn how Git Sync keeps Grafana and your repository in step.
        </Trans>
      </Text>
    </div>
  );
}

/**
 * Migrate to GitOps tab. Shows an overview of how much of the instance is
 * already managed and how much progress has been made toward GitOps. The
 * interactive migration workflow (folder leaderboard, quick wins, the migrate
 * drawer) lands in follow-up changes.
 */
export function Migrate() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateTotals(breakdowns), [breakdowns]);
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

  if (totals.instanceTotal === 0) {
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

const getStyles = (theme: GrafanaTheme2) => ({
  intro: css({
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
});
