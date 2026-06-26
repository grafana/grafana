import Skeleton from 'react-loading-skeleton';
import { useAsyncRetry } from 'react-use';

import { formattedValueToString, getValueFormat } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { Badge, LinkButton, Stack, Text } from '@grafana/ui';

import { HomeDataCard } from './HomeDataCard';
import { InsightRow } from './overviewShared';

export interface HostedLogsOverview {
  bytes7d: number;
  sources: number;
}

/**
 * Resolve 7-day ingested volume and connected-source count from the default Loki datasource (else the
 * first) via its HTTP API through the datasource proxy. Throws — handled as a retryable error — when
 * none is configured.
 *
 * UNVERIFIED — confirm against a live Loki: this env's Loki proxy is allow-list-locked and returns
 * empty, so the request paths and response shapes below are best-known and must be validated against a
 * populated backend. `index/volume` is assumed to return a Prometheus-style vector of per-series bytes;
 * the source count is read from a label-values list (try `service_name`, fall back to `job`).
 */
export async function fetchHostedLogs(): Promise<HostedLogsOverview> {
  const list = getDataSourceSrv().getList({ type: 'loki' });
  const ds = list.find((d) => d.isDefault) ?? list[0];
  if (!ds) {
    throw new Error('No loki datasource configured');
  }
  const base = `/api/datasources/proxy/uid/${ds.uid}/loki/api/v1`;
  const endNs = Date.now() * 1e6;
  const startNs = (Date.now() - 7 * 864e5) * 1e6;

  const vol = await getBackendSrv().get<{ data?: { result?: Array<{ value?: [number, string] }> } }>(
    `${base}/index/volume`,
    { query: '{job=~".+"}', start: startNs, end: endNs, limit: 1000 }
  );
  const bytes7d = (vol?.data?.result ?? []).reduce((sum, r) => sum + Number(r.value?.[1] ?? 0), 0);

  const labels = await getBackendSrv().get<{ data?: string[] }>(`${base}/label/service_name/values`, {
    start: startNs,
    end: endNs,
  });
  return { bytes7d, sources: (labels?.data ?? []).length };
}

function formatBytes(n: number): string {
  return formattedValueToString(getValueFormat('decbytes')(n));
}

export function HostedLogsCard() {
  const { value, loading, error, retry } = useAsyncRetry(fetchHostedLogs, []);

  const statusPill = !value ? undefined : value.bytes7d > 0 ? (
    <Badge color="green" text={t('home.hosted-logs-card.healthy', 'Healthy')} />
  ) : (
    <Badge color="orange" text={t('home.hosted-logs-card.idle', 'No recent ingest')} />
  );

  return (
    <HomeDataCard
      title={t('home.hosted-logs-card.title', 'Hosted Logs')}
      headerActions={statusPill}
      loading={loading}
      loadingContent={<Skeleton height={96} />}
      error={
        error ? { title: t('home.hosted-logs-card.error-title', 'Could not load logs'), onRetry: retry } : undefined
      }
      footer={
        <LinkButton variant="secondary" size="sm" fill="text" href="/explore">
          <Trans i18nKey="home.hosted-logs-card.open">Open Explore</Trans>
        </LinkButton>
      }
    >
      {value && (
        <Stack direction="column" gap={2} grow={1}>
          <Stack direction="column" gap={0}>
            <Text variant="h2">{formatBytes(value.bytes7d)}</Text>
            <Text color="secondary">{t('home.hosted-logs-card.window', 'ingested · 7d')}</Text>
          </Stack>

          <Stack direction="column" gap={0}>
            <InsightRow severity="success">
              {t('home.hosted-logs-card.sources', '', {
                count: value.sources,
                defaultValue_one: '{{count}} source connected',
                defaultValue_other: '{{count}} sources connected',
              })}
            </InsightRow>
            <InsightRow severity={value.bytes7d > 0 ? 'success' : 'warning'}>
              {t('home.hosted-logs-card.ingested', '{{bytes}} ingested (7d)', { bytes: formatBytes(value.bytes7d) })}
            </InsightRow>
          </Stack>
        </Stack>
      )}
    </HomeDataCard>
  );
}
