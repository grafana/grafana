import Skeleton from 'react-loading-skeleton';
import { useAsyncRetry } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Badge, LinkButton, Stack, Text } from '@grafana/ui';
import { sloApi, type Slo } from 'app/features/alerting/unified/api/sloApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HomeDataCard } from './HomeDataCard';
import { InsightRow, runInstantQueriesForDataSourceUids } from './overviewShared';

const SLO_OVERVIEW_QUERIES: Record<string, string> = {
  aboveTarget1d: `count(
  (
    sum by (grafana_slo_uuid) (sum_over_time((grafana_slo_success_rate_5m < +Inf)[1d:5m]))
    / sum by (grafana_slo_uuid) (sum_over_time((grafana_slo_total_rate_5m < +Inf)[1d:5m]))
    or avg by (grafana_slo_uuid) (grafana_slo_sli_1d)
  )
  > on(grafana_slo_uuid) max by (grafana_slo_uuid) (grafana_slo_objective)
) OR on() vector(0)`,
  recording: 'count(count by (grafana_slo_uuid)(grafana_slo_sli_5m)) OR on() vector(0)',
  sliSeries: 'count({__name__=~"grafana_slo_.*", grafana_slo_uuid!=""}) OR on() vector(0)',
};

export interface SlosOverview {
  defined: number;
  aboveTarget1d: number;
  recording: number;
  sliSeries: number;
}

function getDefaultPrometheusDatasourceUid(): string {
  const list = getDataSourceSrv().getList({ type: 'prometheus' });
  const ds = list.find((d) => d.isDefault) ?? list[0];
  if (!ds) {
    throw new Error('No prometheus datasource configured');
  }
  return ds.uid;
}

export function getSloDatasourceUids(slos: Slo[]): string[] {
  const explicitUids = slos.flatMap((slo) => (slo.destinationDatasource?.uid ? [slo.destinationDatasource.uid] : []));
  const hasSloWithoutDatasource = slos.some((slo) => !slo.destinationDatasource?.uid);
  return Array.from(
    new Set(hasSloWithoutDatasource ? [...explicitUids, getDefaultPrometheusDatasourceUid()] : explicitUids)
  );
}

export async function fetchSloOverview(slos: Slo[]): Promise<SlosOverview> {
  if (slos.length === 0) {
    return { defined: 0, aboveTarget1d: 0, recording: 0, sliSeries: 0 };
  }

  const datasourceUids = getSloDatasourceUids(slos);
  const metrics = await runInstantQueriesForDataSourceUids(datasourceUids, SLO_OVERVIEW_QUERIES);

  return {
    defined: slos.length,
    aboveTarget1d: metrics.aboveTarget1d ?? 0,
    recording: metrics.recording ?? 0,
    sliSeries: metrics.sliSeries ?? 0,
  };
}

export function SlosCard() {
  const {
    data,
    isLoading: slosLoading,
    error: slosError,
    refetch,
  } = sloApi.endpoints.getSlos.useQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });
  const slos = data?.slos;
  const {
    value,
    loading: overviewLoading,
    error: overviewError,
    retry,
  } = useAsyncRetry(async () => {
    if (!slos) {
      return null;
    }

    return fetchSloOverview(slos);
  }, [slos]);

  const loading = slosLoading || (!!slos && overviewLoading);
  const error = slosError || overviewError;
  const retryAll = () => {
    refetch();
    retry();
  };

  const belowTarget = value ? Math.max(value.defined - value.aboveTarget1d, 0) : 0;

  const statusPill =
    !value || value.defined === 0 ? undefined : belowTarget === 0 ? (
      <Badge color="green" text={t('home.slos-card.healthy', 'Healthy')} />
    ) : (
      <Badge
        color="orange"
        text={t('home.slos-card.below-target-badge', '', {
          count: belowTarget,
          defaultValue_one: '{{count}} below target',
          defaultValue_other: '{{count}} below target',
        })}
      />
    );

  return (
    <HomeDataCard
      title={t('home.slos-card.title', 'SLOs')}
      headerActions={statusPill}
      loading={loading}
      loadingContent={<Skeleton height={96} />}
      error={error ? { title: t('home.slos-card.error-title', 'Could not load SLOs'), onRetry: retryAll } : undefined}
      isEmpty={!!value && value.defined === 0}
      emptyMessage={t('home.slos-card.empty', 'No SLOs defined.')}
      footer={
        <LinkButton
          variant="secondary"
          size="sm"
          fill="text"
          href={createBridgeURL(SupportedPlugin.Slo, '/manage-slos')}
        >
          <Trans i18nKey="home.slos-card.open">Open SLOs</Trans>
        </LinkButton>
      }
    >
      {value && (
        <Stack direction="column" gap={2} grow={1}>
          <Stack direction="column" gap={0}>
            <Text variant="h2">{value.defined.toLocaleString()}</Text>
            <Text color="secondary">{t('home.slos-card.defined', 'SLOs defined')}</Text>
          </Stack>

          <Stack direction="column" gap={0}>
            <InsightRow severity={belowTarget === 0 ? 'success' : 'warning'}>
              {t('home.slos-card.above-target', '{{value}} above target (1 day)', {
                value: value.aboveTarget1d.toLocaleString(),
              })}
            </InsightRow>
            <InsightRow severity={value.recording >= value.defined ? 'success' : 'warning'}>
              {t('home.slos-card.recording', '{{value}} SLOs recording', {
                value: value.recording.toLocaleString(),
              })}
            </InsightRow>
            <InsightRow severity={value.sliSeries > 0 ? 'success' : 'warning'}>
              {t('home.slos-card.sli-series', '{{value}} recorded SLI series', {
                value: value.sliSeries.toLocaleString(),
              })}
            </InsightRow>
          </Stack>
        </Stack>
      )}
    </HomeDataCard>
  );
}
