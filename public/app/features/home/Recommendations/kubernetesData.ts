import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type FieldSparkline,
  store,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  createTtlCachedPromise,
  findDatasourceWithData,
  listProbeCandidates,
  MAX_PROBED_DATASOURCES,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
  withRetry,
} from './probeUtils';
import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';

/** Kubernetes Monitoring app plugin ID. @lintignore */
export const KUBERNETES_APP_ID = 'grafana-k8s-app';

export interface KubernetesInventory {
  clusters: number;
  pods: number;
}

export interface KubernetesHealth {
  alertsFiring: number | null; // null = no firing alerts or Prometheus evaluates no rules (hide the count)
  unhealthyPods: number | null; // null = metric absent (hide the row); 0 = all healthy
  restarts1h: number | null; // null = metric absent (hide the row)
  notReadyNodes: number | null; // null = metric absent (hide the row); 0 = all Ready
}

// Lookback for the inventory queries and the namespace probe: "seen recently", tolerating scrape gaps.
const KUBE_STATE_LOOKBACK = '24h';

// refId -> portable kube-state-metrics PromQL: inventory uses last_over_time[24h], health stats are instant vectors.
const INVENTORY_QUERIES: Record<string, string> = {
  clusters: `count(group by (cluster) (last_over_time(kube_node_info[${KUBE_STATE_LOOKBACK}])))`,
  pods: `count(group by (cluster, namespace, pod) (last_over_time(kube_pod_info[${KUBE_STATE_LOOKBACK}])))`,
};

const HEALTH_QUERIES: Record<string, string> = {
  unhealthyPods: 'sum(kube_pod_status_phase{phase=~"Pending|Failed|Unknown"})',
  restarts1h: 'sum(increase(kube_pod_container_status_restarts_total[1h]))',
  notReadyNodes: 'sum(kube_node_status_condition{condition="Ready",status=~"false|unknown"})',
};

// Firing alert instances scoped to Kubernetes workloads; heartbeats excluded.
const ALERTS_MATCHER = '{alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""}';

// Never user-visible (useAsync swallows it) — no i18n. Tests assert this exact message.
const NO_KUBERNETES_DATA_ERROR = 'No Prometheus datasource with Kubernetes data';

// Mirrors the k8s app's namespace detection (kube_namespace_status_phase), with the inventory lookback.
const NAMESPACE_PROBE = `count(last_over_time(kube_namespace_status_phase[${KUBE_STATE_LOOKBACK}]))`;

/** True when health signals show a problem, false when all clear, null when none are available. @lintignore */
export function hasHealthProblems(h: KubernetesHealth): boolean | null {
  if (h.alertsFiring === null && h.unhealthyPods === null && h.notReadyNodes === null && h.restarts1h === null) {
    return null;
  }
  // null counts as 0 so a partial metric set still verdicts.
  return (h.unhealthyPods ?? 0) + (h.notReadyNodes ?? 0) + (h.restarts1h ?? 0) + (h.alertsFiring ?? 0) > 0;
}

// localStorage key where the k8s app's PrometheusPicker persists the user's datasource choice.
const K8S_APP_STORAGE_KEY = 'grafana.k8s-app.navigation.storage';

// Priority: the k8s app's stored choice, then — skipping cloud utility datasources — the default, then list order.
async function orderedCandidates(): Promise<DataSourceInstanceListItem[]> {
  // Uncapped: the stored preference must be honored even when it sits past the fan-out cap;
  // resolveKubernetesPrometheus applies the cap after this reorder.
  const ordered = await listProbeCandidates('prometheus', { cap: Number.POSITIVE_INFINITY });
  let promName: string | undefined;
  try {
    // store.getObject absorbs missing/corrupt values; the try guards localStorage access itself throwing.
    const stored = store.getObject<{ promName?: unknown }>(K8S_APP_STORAGE_KEY, {});
    promName = typeof stored.promName === 'string' ? stored.promName : undefined;
  } catch {
    // Storage access denied — fall through to the heuristic.
  }
  const storedMatch = promName ? ordered.find((ds) => ds.name === promName) : undefined;
  return storedMatch ? [storedMatch, ...ordered.filter((ds) => ds !== storedMatch)] : ordered;
}

// "Has Kubernetes data" = namespaces detected; an errored probe retries with backoff, then counts
// as no data — an unusable datasource must not win the probe.
async function hasKubernetesNamespaces(ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>): Promise<boolean> {
  try {
    const frames = await withRetry(() => runInstantQueries({ namespaces: NAMESPACE_PROBE }, ds, PROBE_TIMEOUT_MS));
    return (readScalar(frames, 'namespaces') ?? 0) > 0;
  } catch {
    return false;
  }
}

// Leader-first probe over the ordered candidates; see findDatasourceWithData for the fan-out rules.
async function resolveKubernetesPrometheus(): Promise<DataSourceInstanceListItem | null> {
  const candidates = (await orderedCandidates()).slice(0, MAX_PROBED_DATASOURCES);
  return findDatasourceWithData(candidates, hasKubernetesNamespaces);
}

const kubernetesPrometheusResolution = createTtlCachedPromise(resolveKubernetesPrometheus, PROBE_TTL_MS);

// Reset the cached datasource resolution (test seam).
export function resetKubernetesPrometheusResolution(): void {
  kubernetesPrometheusResolution.reset();
}

/** Resolved Prometheus datasource with Kubernetes data, or null when none. */
export async function resolveKubernetesDatasource(): Promise<DataSourceInstanceListItem | null> {
  return kubernetesPrometheusResolution.get();
}

// All fetches await the same TTL-cached resolution promise, so concurrent mount = one probe, then
// inventory/health/CPU requests run in parallel (a shared prerequisite, then parallel).

/** Cluster and pod counts via kube-state-metrics; throws when no datasource has Kubernetes data. */
export async function fetchKubernetesInventory(): Promise<KubernetesInventory> {
  const ds = await kubernetesPrometheusResolution.get();
  if (!ds) {
    throw new Error(NO_KUBERNETES_DATA_ERROR);
  }
  const frames = await withRetry(() => runInstantQueries(INVENTORY_QUERIES, ds));
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    pods: readScalar(frames, 'pods') ?? 0,
  };
}

/** Health signals via kube-state-metrics and alert metrics; throws when no datasource has Kubernetes data. */
export async function fetchKubernetesHealth(): Promise<KubernetesHealth> {
  const ds = await kubernetesPrometheusResolution.get();
  if (!ds) {
    throw new Error(NO_KUBERNETES_DATA_ERROR);
  }
  // Grafana-managed firing alerts live in the state-history target datasource under a
  // configurable metric name; hard-coding GRAFANA_ALERTS on the k8s datasource misses them.
  const grafanaMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  const grafanaAlertsUid = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
  const sameDatasource = !grafanaAlertsUid || grafanaAlertsUid === ds.uid;

  const queries: Record<string, string> = {
    ...HEALTH_QUERIES,
    // Same datasource: union with `or` so identical series never double-count.
    alertsFiring: sameDatasource
      ? `count(ALERTS${ALERTS_MATCHER} or ${grafanaMetric}${ALERTS_MATCHER})`
      : `count(ALERTS${ALERTS_MATCHER})`,
  };

  const [frames, grafanaAlertsFiring] = await Promise.all([
    withRetry(() => runInstantQueries(queries, ds)),
    sameDatasource ? Promise.resolve(null) : fetchGrafanaManagedAlertCount(grafanaAlertsUid, grafanaMetric),
  ]);

  const dsAlertsFiring = readScalar(frames, 'alertsFiring');
  const restarts1h = readScalar(frames, 'restarts1h');
  return {
    alertsFiring:
      dsAlertsFiring === null && grafanaAlertsFiring === null
        ? null
        : (dsAlertsFiring ?? 0) + (grafanaAlertsFiring ?? 0),
    unhealthyPods: readScalar(frames, 'unhealthyPods'),
    // increase() extrapolates to fractionals with zero real restarts; round so noise never renders as "1 restart".
    restarts1h: restarts1h === null ? null : Math.round(restarts1h),
    notReadyNodes: readScalar(frames, 'notReadyNodes'),
  };
}

// A broken/absent state-history datasource must not blank the whole health row: fail to null.
async function fetchGrafanaManagedAlertCount(uid: string, metric: string): Promise<number | null> {
  try {
    const frames = await withRetry(() =>
      runInstantQueries({ grafanaAlertsFiring: `count(${metric}${ALERTS_MATCHER})` }, { uid, type: 'prometheus' })
    );
    return readScalar(frames, 'grafanaAlertsFiring');
  } catch {
    return null;
  }
}

/** Cluster CPU over 24h (cAdvisor); throws when no datasource has Kubernetes data, null when the metric is absent. */
export async function fetchClusterCpuSeries(): Promise<FieldSparkline | null> {
  const ds = await kubernetesPrometheusResolution.get();
  if (!ds) {
    throw new Error(NO_KUBERNETES_DATA_ERROR);
  }
  const frames = await withRetry(() =>
    runRangeQuery('cpu', 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m]))', 24, ds)
  );
  return readSeries(frames, 'cpu');
}
