import Skeleton from 'react-loading-skeleton';
import { useAsyncRetry } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { Badge, LinkButton, Stack, Text } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { HomeDataCard } from './HomeDataCard';
import { InsightRow, readScalar, runInstantQueries } from './overviewShared';

export const KUBERNETES_APP_ID = 'grafana-k8s-app';

export interface KubernetesOverview {
  clusters: number;
  pods: number;
  unhealthyPods: number | null; // null = metric absent (hide the row); 0 = all healthy
  restarts1h: number | null; // null = metric absent (hide the row)
  notReadyNodes: number | null; // null = metric absent (hide the row); 0 = all Ready
}

const KUBE_STATE_LOOKBACK = '24h';

// refId -> portable kube-state-metrics PromQL. No recording rules: works on any Prometheus scraping
// kube-state-metrics. Use a lookback for gauge-style kube-state metrics so seeded/demo samples that
// are not continuously scraped still render after Prometheus's instant-query lookback expires.
// `group by (...)` dedupes series across replicas before count().
const OVERVIEW_QUERIES: Record<string, string> = {
  clusters: `count(group by (cluster) (last_over_time(kube_node_info[${KUBE_STATE_LOOKBACK}])))`,
  pods: `count(group by (cluster, namespace, pod) (last_over_time(kube_pod_info[${KUBE_STATE_LOOKBACK}])))`,
  unhealthyPods: `sum(last_over_time(kube_pod_status_phase{phase=~"Pending|Failed|Unknown"}[${KUBE_STATE_LOOKBACK}]))`,
  restarts1h: 'sum(increase(kube_pod_container_status_restarts_total[1h]))',
  notReadyNodes: `sum(last_over_time(kube_node_status_condition{condition="Ready",status="false"}[${KUBE_STATE_LOOKBACK}]))`,
};

type KubernetesHealthSeverity = 'healthy' | 'warning' | 'critical';

export interface KubernetesHealth {
  // Total problems = unhealthy pods + not-ready nodes + recent container restarts, over the available signals.
  issues: number;
  severity: KubernetesHealthSeverity;
}

// Collapse the three health signals into one header verdict. Returns null when NONE are available
// (e.g. Prometheus scrapes only inventory metrics) — the pill is then hidden, since absence is not health.
export function computeHealth(o: KubernetesOverview): KubernetesHealth | null {
  if (o.unhealthyPods === null && o.notReadyNodes === null && o.restarts1h === null) {
    return null;
  }
  // Pods pending/failed and not-ready nodes are resources in a bad state (critical); restarts alone are a
  // softer signal (warning). null signals count as 0 so a partial metric set still yields a verdict.
  const badResources = (o.unhealthyPods ?? 0) + (o.notReadyNodes ?? 0);
  const issues = badResources + (o.restarts1h ?? 0);
  const severity: KubernetesHealthSeverity = issues === 0 ? 'healthy' : badResources > 0 ? 'critical' : 'warning';
  return { issues, severity };
}

/**
 * Resolve overview counts from Prometheus rather than a plugin REST endpoint: the k8s app has no
 * "summary" API, so we run portable kube-state-metrics instant queries directly. Picks the default
 * Prometheus datasource, else the first — throwing (handled as a retryable error) when none.
 */
export async function fetchKubernetesOverview(): Promise<KubernetesOverview> {
  const frames = await runInstantQueries('prometheus', OVERVIEW_QUERIES);
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    pods: readScalar(frames, 'pods') ?? 0,
    unhealthyPods: readScalar(frames, 'unhealthyPods'),
    restarts1h: readScalar(frames, 'restarts1h'),
    notReadyNodes: readScalar(frames, 'notReadyNodes'),
  };
}

export function KubernetesOverviewCard() {
  const { installed, loading, settings } = usePluginBridge(KUBERNETES_APP_ID);

  // Hide the card whenever the k8s app isn't available — including while the settings probe is in
  // flight, so the card never flashes in before disappearing.
  if (loading || !installed) {
    return null;
  }

  // Gate the CTA like the IRM cards do: a user without access to the plugin's home page sees no link,
  // not one that 403s on click.
  const canAccess = settings ? canAccessPluginPage(settings, createBridgeURL(KUBERNETES_APP_ID, '/home')) : false;

  return <KubernetesOverviewCardInner canAccess={canAccess} />;
}

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function KubernetesOverviewCardInner({ canAccess }: { canAccess: boolean }) {
  const { value, loading, error, retry } = useAsyncRetry(fetchKubernetesOverview, []);

  const health = value ? computeHealth(value) : null;
  const statusPill =
    health === null ? undefined : health.severity === 'healthy' ? (
      <Badge color="green" text={t('home.kubernetes-card.healthy', 'Healthy')} />
    ) : (
      <Badge
        color={health.severity === 'critical' ? 'red' : 'orange'}
        text={t('home.kubernetes-card.issues', '', {
          count: health.issues,
          defaultValue_one: '{{count}} issue',
          defaultValue_other: '{{count}} issues',
        })}
      />
    );

  return (
    <HomeDataCard
      title={t('home.kubernetes-card.title', 'Kubernetes Monitoring')}
      headerActions={statusPill}
      loading={loading}
      loadingContent={<Skeleton height={96} />}
      error={
        error
          ? { title: t('home.kubernetes-card.error-title', 'Could not load Kubernetes data'), onRetry: retry }
          : undefined
      }
      isEmpty={!!value && value.clusters === 0}
      emptyMessage={t('home.kubernetes-card.empty', 'No Kubernetes metrics found.')}
      footer={
        canAccess ? (
          <LinkButton variant="secondary" size="sm" fill="text" href={createBridgeURL(KUBERNETES_APP_ID, '/home')}>
            <Trans i18nKey="home.kubernetes-card.open-app">Open Kubernetes app</Trans>
          </LinkButton>
        ) : undefined
      }
    >
      {value && (
        <Stack direction="column" gap={2} grow={1}>
          <Stack direction="column" gap={0}>
            <Stack alignItems="baseline" gap={1}>
              <Text variant="h2">{value.pods.toLocaleString()}</Text>
              <Text variant="h4">{t('home.kubernetes-card.pods-unit', 'pods')}</Text>
            </Stack>
            <Text color="secondary">
              {t('home.kubernetes-card.clusters', '', {
                count: value.clusters,
                defaultValue_one: '{{count}} cluster',
                defaultValue_other: '{{count}} clusters',
              })}
            </Text>
          </Stack>

          <Stack direction="column" gap={0}>
            {value.notReadyNodes !== null && (
              <InsightRow severity={value.notReadyNodes === 0 ? 'success' : 'warning'}>
                {value.notReadyNodes === 0
                  ? t('home.kubernetes-card.nodes-ready', 'All nodes ready')
                  : t('home.kubernetes-card.nodes-not-ready', '', {
                      count: value.notReadyNodes,
                      defaultValue_one: '{{count}} node not ready',
                      defaultValue_other: '{{count}} nodes not ready',
                    })}
              </InsightRow>
            )}
            {value.unhealthyPods !== null && (
              <InsightRow severity={value.unhealthyPods === 0 ? 'success' : 'error'}>
                {value.unhealthyPods === 0
                  ? t('home.kubernetes-card.pods-healthy', 'All pods healthy')
                  : t('home.kubernetes-card.pods-unhealthy', '', {
                      count: value.unhealthyPods,
                      defaultValue_one: '{{count}} pod pending or failed',
                      defaultValue_other: '{{count}} pods pending or failed',
                    })}
              </InsightRow>
            )}
            {value.restarts1h !== null && (
              <InsightRow severity={value.restarts1h === 0 ? 'success' : 'warning'}>
                {value.restarts1h === 0
                  ? t('home.kubernetes-card.no-restarts', 'No recent container restarts')
                  : t('home.kubernetes-card.restarts', '', {
                      count: value.restarts1h,
                      defaultValue_one: '{{count}} container restart (1h)',
                      defaultValue_other: '{{count}} container restarts (1h)',
                    })}
              </InsightRow>
            )}
          </Stack>
        </Stack>
      )}
    </HomeDataCard>
  );
}
