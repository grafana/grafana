import Skeleton from 'react-loading-skeleton';
import { useAsyncRetry } from 'react-use';

import { formattedValueToString, getValueFormat } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, LinkButton, Stack, Text } from '@grafana/ui';

import { HomeDataCard } from './HomeDataCard';
import { InsightRow, readScalar, runInstantQueries } from './overviewShared';

// refId -> portable Prometheus self-scrape PromQL. Works on any Prometheus exposing its own TSDB head
// metrics and the `up` series of the targets it scrapes — no recording rules, no Cloud-only metrics.
const METRICS_QUERIES: Record<string, string> = {
  series: 'sum(prometheus_tsdb_head_series)',
  ingestRate: 'sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))',
  targetsUp: 'sum(up)',
  targetsTotal: 'count(up)',
};

export interface HostedMetricsOverview {
  series: number;
  ingestRate: number;
  targetsUp: number;
  targetsTotal: number;
}

/**
 * Resolve active-series, ingest-rate and target-health counts straight from the default Prometheus
 * datasource (else the first). Throws — handled as a retryable error — when none is configured.
 */
export async function fetchHostedMetrics(): Promise<HostedMetricsOverview> {
  const frames = await runInstantQueries('prometheus', METRICS_QUERIES);
  return {
    series: readScalar(frames, 'series') ?? 0,
    ingestRate: readScalar(frames, 'ingestRate') ?? 0,
    targetsUp: readScalar(frames, 'targetsUp') ?? 0,
    targetsTotal: readScalar(frames, 'targetsTotal') ?? 0,
  };
}

function formatShort(n: number): string {
  return formattedValueToString(getValueFormat('short')(n));
}

export function HostedMetricsCard() {
  const { value, loading, error, retry } = useAsyncRetry(fetchHostedMetrics, []);

  // total === 0 (no scraped targets) reads as healthy: there is nothing in a bad state to report.
  const allUp = !!value && (value.targetsTotal === 0 || value.targetsUp >= value.targetsTotal);
  const statusPill = !value ? undefined : allUp ? (
    <Badge color="green" text={t('home.hosted-metrics-card.healthy', 'Healthy')} />
  ) : (
    <Badge
      color="orange"
      text={t('home.hosted-metrics-card.targets-down', '', {
        count: value.targetsTotal - value.targetsUp,
        defaultValue_one: '{{count}} target down',
        defaultValue_other: '{{count}} targets down',
      })}
    />
  );

  return (
    <HomeDataCard
      title={t('home.hosted-metrics-card.title', 'Hosted Metrics')}
      headerActions={statusPill}
      loading={loading}
      loadingContent={<Skeleton height={96} />}
      error={
        error
          ? { title: t('home.hosted-metrics-card.error-title', 'Could not load metrics'), onRetry: retry }
          : undefined
      }
      footer={
        <LinkButton variant="secondary" size="sm" fill="text" href="/explore">
          <Trans i18nKey="home.hosted-metrics-card.open">Open metrics</Trans>
        </LinkButton>
      }
    >
      {value && (
        <Stack direction="column" gap={2} grow={1}>
          <Stack direction="column" gap={0}>
            <Stack alignItems="baseline" gap={1}>
              <Text variant="h2">{formatShort(value.series)}</Text>
              <Text variant="h4">{t('home.hosted-metrics-card.series-unit', 'series')}</Text>
            </Stack>
            <Text color="secondary">
              {t('home.hosted-metrics-card.ingest', '{{rate}}/s ingested', { rate: formatShort(value.ingestRate) })}
            </Text>
          </Stack>

          <Stack direction="column" gap={0}>
            <InsightRow severity={value.targetsUp >= value.targetsTotal ? 'success' : 'warning'}>
              {value.targetsUp >= value.targetsTotal
                ? t('home.hosted-metrics-card.targets-up', '', {
                    count: value.targetsTotal,
                    defaultValue_one: 'All {{count}} target up',
                    defaultValue_other: 'All {{count}} targets up',
                  })
                : t('home.hosted-metrics-card.targets-some-down', '{{up}} of {{total}} targets up', {
                    up: value.targetsUp,
                    total: value.targetsTotal,
                  })}
            </InsightRow>
            <InsightRow severity="success">
              {t('home.hosted-metrics-card.ingesting', 'Ingesting {{rate}}/s', { rate: formatShort(value.ingestRate) })}
            </InsightRow>
          </Stack>
        </Stack>
      )}
    </HomeDataCard>
  );
}
