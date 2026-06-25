import { type ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAsyncRetry } from 'react-use';
import { from, lastValueFrom } from 'rxjs';

import {
  CoreApp,
  type DataFrame,
  type DataQuery,
  type DataQueryRequest,
  FieldType,
  generateUUID,
  getDefaultTimeRange,
  rangeUtil,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Badge, Icon, LinkButton, Stack, Text } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { HomeDataCard } from './HomeDataCard';

export const KUBERNETES_APP_ID = 'grafana-k8s-app';

export interface KubernetesOverview {
  clusters: number;
  nodes: number;
  namespaces: number;
  pods: number;
  unhealthyPods: number | null; // null = metric absent (hide the row); 0 = all healthy
  restarts1h: number | null; // null = metric absent (hide the row)
  notReadyNodes: number | null; // null = metric absent (hide the badge); 0 = all Ready
}

// refId -> portable kube-state-metrics PromQL. No recording rules: works on any Prometheus scraping
// kube-state-metrics. `group by (...)` dedupes series across replicas before count().
const OVERVIEW_QUERIES: Record<string, string> = {
  clusters: 'count(group by (cluster) (kube_node_info))',
  nodes: 'count(group by (cluster, node) (kube_node_info))',
  namespaces: 'count(group by (cluster, namespace) (kube_namespace_created))',
  pods: 'count(group by (cluster, namespace, pod) (kube_pod_info))',
  unhealthyPods: 'sum(kube_pod_status_phase{phase=~"Pending|Failed|Unknown"})',
  restarts1h: 'sum(increase(kube_pod_container_status_restarts_total[1h]))',
  notReadyNodes: 'sum(kube_node_status_condition{condition="Ready",status="false"})',
};

// Prometheus carries expr/instant/range on each target; model them on top of DataQuery so the
// request is fully typed without importing the plugin's PromQuery type.
interface InstantQueryTarget extends DataQuery {
  expr: string;
  instant: boolean;
  range: boolean;
}

function readScalar(frames: DataFrame[], refId: string): number | null {
  const field = frames.find((f) => f.refId === refId)?.fields.find((f) => f.type === FieldType.number);
  const v = field && field.values.length ? field.values[field.values.length - 1] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Resolve overview counts from Prometheus rather than a plugin REST endpoint: the k8s app has no
 * "summary" API, so we run portable kube-state-metrics instant queries directly. Picks the default
 * Prometheus datasource, else the first — throwing (handled as a retryable error) when none.
 */
export async function fetchKubernetesOverview(): Promise<KubernetesOverview> {
  const proms = getDataSourceSrv().getList({ type: 'prometheus' });
  const settings = proms.find((d) => d.isDefault) ?? proms[0];
  if (!settings) {
    throw new Error('No Prometheus datasource configured');
  }
  const ds = await getDataSourceSrv().get(settings.uid);
  const range = getDefaultTimeRange();
  const intervalInfo = rangeUtil.calculateInterval(range, 1);
  // Prometheus reads expr/instant/range off each target at runtime; the local InstantQueryTarget
  // type carries them so the request is fully typed (same field set as Loki's makeRequest()).
  const targets: InstantQueryTarget[] = Object.entries(OVERVIEW_QUERIES).map(([refId, expr]) => ({
    refId,
    expr,
    instant: true,
    range: false,
  }));
  const request: DataQueryRequest<InstantQueryTarget> = {
    requestId: `k8s-overview-${generateUUID()}`,
    interval: intervalInfo.interval,
    intervalMs: intervalInfo.intervalMs,
    range,
    scopedVars: {},
    timezone: 'UTC',
    app: CoreApp.Unknown,
    startTime: Date.now(),
    targets,
  };

  const result = await lastValueFrom(from(ds.query(request)));
  const frames = result.data ?? [];
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    nodes: readScalar(frames, 'nodes') ?? 0,
    namespaces: readScalar(frames, 'namespaces') ?? 0,
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

function InsightRow({ ok, children }: { ok: boolean; children: NonNullable<ReactNode> }) {
  return (
    <Stack alignItems="center" gap={1}>
      <Icon name={ok ? 'check-circle' : 'exclamation-triangle'} />
      <Text color="secondary">{children}</Text>
    </Stack>
  );
}

/**
 * Inner component avoids calling hooks conditionally —
 * the availability gate lives in the parent wrapper.
 */
function KubernetesOverviewCardInner({ canAccess }: { canAccess: boolean }) {
  const { value, loading, error, retry } = useAsyncRetry(fetchKubernetesOverview, []);

  const healthBadge =
    !value || value.notReadyNodes === null ? undefined : value.notReadyNodes === 0 ? (
      <Badge color="green" text={t('home.kubernetes-card.healthy', 'Healthy')} />
    ) : (
      <Badge
        color="red"
        text={t('home.kubernetes-card.nodes-not-ready', '', {
          count: value.notReadyNodes,
          defaultValue_one: '{{count}} node not ready',
          defaultValue_other: '{{count}} nodes not ready',
        })}
      />
    );

  return (
    <HomeDataCard
      title={t('home.kubernetes-card.title', 'Kubernetes Monitoring')}
      headerActions={healthBadge}
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
              <Text variant="h1">{value.pods.toLocaleString()}</Text>
              <Text variant="h5" color="secondary">
                {t('home.kubernetes-card.pods-unit', 'pods')}
              </Text>
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
            <Text color="secondary">
              {t('home.kubernetes-card.nodes', '', {
                count: value.nodes,
                defaultValue_one: '{{count}} node',
                defaultValue_other: '{{count}} nodes',
              })}
            </Text>
            <Text color="secondary">
              {t('home.kubernetes-card.namespaces', '', {
                count: value.namespaces,
                defaultValue_one: '{{count}} namespace',
                defaultValue_other: '{{count}} namespaces',
              })}
            </Text>
          </Stack>

          <Stack direction="column" gap={0}>
            {value.unhealthyPods !== null && (
              <InsightRow ok={value.unhealthyPods === 0}>
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
              <InsightRow ok={value.restarts1h === 0}>
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
