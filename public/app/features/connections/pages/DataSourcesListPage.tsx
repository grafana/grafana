import { css } from '@emotion/css';

import { dateTimeFormatTimeAgo, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { AdvisorRedirectNotice } from 'app/features/connections/components/AdvisorRedirectNotice/AdvisorRedirectNotice';
import { DataSourceAddButton } from 'app/features/datasources/components/DataSourceAddButton';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { useAdvisorHealthStatus } from 'app/features/datasources/hooks/useAdvisorHealthStatus';
import { useRunHealthChecks } from 'app/features/datasources/hooks/useRunHealthChecks';
import { getDataSourcesCount } from 'app/features/datasources/state/selectors';
import { StoreState, useSelector } from 'app/types/store';

export function DataSourcesListPage() {
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));
  const { isRunning, runHealthChecks, enabled: advisorEnabled } = useRunHealthChecks();
  const { lastChecked } = useAdvisorHealthStatus();
  const styles = useStyles2(getStyles);

  const actions =
    dataSourcesCount > 0 ? (
      <Stack direction="row" gap={1}>
        {advisorEnabled && (
          <Button
            variant="secondary"
            icon={isRunning ? 'spinner' : 'sync'}
            onClick={runHealthChecks}
            disabled={isRunning}
          >
            {isRunning
              ? t('datasources.health-checks.running', 'Running health checks…')
              : t('datasources.health-checks.run', 'Run health checks')}
          </Button>
        )}
        <DataSourceAddButton />
      </Stack>
    ) : undefined;

  const subTitle = advisorEnabled ? (
    <div className={styles.subTitle}>
      <span>{t('datasources.subtitle', 'View and manage your connected data connections')}</span>
      {lastChecked && (
        <span className={styles.lastChecked}>
          <Icon name="clock-nine" size="xs" />
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="datasources.health-checks.last-run">
              Last health check run: {{ timeAgo: dateTimeFormatTimeAgo(lastChecked) }}
            </Trans>
          </Text>
        </span>
      )}
    </div>
  ) : undefined;

  return (
    <Page navId={'connections-datasources'} actions={actions} subTitle={subTitle}>
      <Page.Contents>
        <AdvisorRedirectNotice />
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  subTitle: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  }),
  lastChecked: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.secondary,
  }),
});
