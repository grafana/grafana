import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type FieldSparkline,
  store,
} from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';

/** Kubernetes Monitoring app plugin ID. @lintignore */
export const KUBERNETES_APP_ID = 'grafana-k8s-app';

export interface KubernetesOverview {
  clusters: number;
  pods: number;
  alertsFiring: number | null; // null = no firing alerts or Prometheus evaluates no rules (hide the count)
  unhealthyPods: number | null; // null = metric absent (hide the row); 0 = all healthy
  restarts1h: number | null; // null = metric absent (hide the row)
  notReadyNodes: number | null; // null = metric absent (hide the row); 0 = all Ready
}

// Lookback for the inventory queries and the namespace probe: "seen recently", tolerating scrape gaps.
const KUBE_STATE_LOOKBACK = '24h';

// refId -> portable kube-state-metrics PromQL: inventory uses last_over_time[24h], health stats are instant vectors.
const OVERVIEW_QUERIES: Record<string, string> = {
  clusters: `count(group by (cluster) (last_over_time(kube_node_info[${KUBE_STATE_LOOKBACK}])))`,
  pods: `count(group by (cluster, namespace, pod) (last_over_time(kube_pod_info[${KUBE_STATE_LOOKBACK}])))`,
  unhealthyPods: 'sum(kube_pod_status_phase{phase=~"Pending|Failed|Unknown"})',
  restarts1h: 'sum(increase(kube_pod_container_status_restarts_total[1h]))',
  notReadyNodes: 'sum(kube_node_status_condition{condition="Ready",status=~"false|unknown"})',
  // Unions datasource-managed ALERTS with Grafana-managed GRAFANA_ALERTS; kube-prometheus-stack heartbeats excluded.
  alertsFiring:
    'count(ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor"} or GRAFANA_ALERTS{alertstate="firing"})',
};

// Cap the probe fan-out: only the first 10 candidates (in priority order) are probed per page load.
const MAX_PROBED_DATASOURCES = 10;

// Never user-visible (useAsync swallows it) — no i18n. Tests assert this exact message.
const NO_KUBERNETES_DATA_ERROR = 'No Prometheus datasource with Kubernetes data';

// Mirrors the k8s app's namespace detection (kube_namespace_status_phase), with the inventory lookback.
const NAMESPACE_PROBE = `count(last_over_time(kube_namespace_status_phase[${KUBE_STATE_LOOKBACK}]))`;

/** True when health signals show a problem, false when all clear, null when none are available. @lintignore */
export function hasHealthProblems(o: KubernetesOverview): boolean | null {
  if (o.alertsFiring === null && o.unhealthyPods === null && o.notReadyNodes === null && o.restarts1h === null) {
    return null;
  }
  // null counts as 0 so a partial metric set still verdicts.
  return (o.unhealthyPods ?? 0) + (o.notReadyNodes ?? 0) + (o.restarts1h ?? 0) + (o.alertsFiring ?? 0) > 0;
}

// localStorage key where the k8s app's PrometheusPicker persists the user's datasource choice.
const K8S_APP_STORAGE_KEY = 'grafana.k8s-app.navigation.storage';

// Exact names of Grafana Cloud's utility Prometheus datasources (billing/ML) — never where kube-state-metrics lives.
const CLOUD_UTILITY_DATASOURCE_NAMES: Record<string, true> = {
  'grafanacloud-usage': true,
  'grafanacloud-ml-metrics': true,
};

// Priority: the k8s app's stored choice, then — skipping cloud utility datasources — the default, then list order.
async function orderedCandidates(): Promise<DataSourceInstanceListItem[]> {
  const list = await getDataSourceInstanceList({
    type: 'prometheus',
    // Reject the -- Grafana -- builtin by meta.id; a ds.type check would drop prometheus-alias datasources.
    filter: (ds) => ds.meta.id !== 'grafana',
  });
  let promName: string | undefined;
  try {
    // store.getObject absorbs missing/corrupt values; the try guards localStorage access itself throwing.
    const stored = store.getObject<{ promName?: unknown }>(K8S_APP_STORAGE_KEY, {});
    promName = typeof stored.promName === 'string' ? stored.promName : undefined;
  } catch {
    // Storage access denied — fall through to the heuristic.
  }
  const preferred = list.filter((ds) => !CLOUD_UTILITY_DATASOURCE_NAMES[ds.name]);
  const pool = preferred.length > 0 ? preferred : list;
  const def = pool.find((ds) => ds.isDefault);
  const ordered = def ? [def, ...pool.filter((ds) => ds !== def)] : [...pool];
  const storedMatch = promName ? list.find((ds) => ds.name === promName) : undefined;
  return storedMatch ? [storedMatch, ...ordered.filter((ds) => ds !== storedMatch)] : ordered;
}

// "Has Kubernetes data" = namespaces detected; an errored probe retries once, then counts as no data.
async function hasKubernetesNamespaces(ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const frames = await runInstantQueries({ namespaces: NAMESPACE_PROBE }, ds);
      return (readScalar(frames, 'namespaces') ?? 0) > 0;
    } catch {
      // Retry once, then give up: an unusable datasource must not win the probe.
    }
  }
  return false;
}

// One shared resolution per TTL window; the TTL lets a later home visit re-resolve after datasource changes.
const RESOLUTION_TTL_MS = 60_000;

// Owns the cached promise + timestamp in a closure so no module-level binding is mutated.
function createTtlCachedPromise<T>(fn: () => Promise<T>, ttlMs: number): { get(): Promise<T>; reset(): void } {
  let cached: Promise<T> | undefined;
  let cachedAt = 0;
  return {
    get() {
      if (!cached || Date.now() - cachedAt > ttlMs) {
        cachedAt = Date.now();
        cached = fn();
      }
      return cached;
    },
    reset() {
      cached = undefined;
      cachedAt = 0;
    },
  };
}

// Probe all candidates in parallel, settle on the highest-priority one with data; null = "not enabled".
async function resolveKubernetesPrometheus(): Promise<DataSourceInstanceListItem | null> {
  const candidates = (await orderedCandidates()).slice(0, MAX_PROBED_DATASOURCES);
  const probes = candidates.map((ds) => hasKubernetesNamespaces(ds));
  for (let i = 0; i < candidates.length; i++) {
    // Await in priority order: a slow high-priority probe delays — never changes — the outcome.
    if (await probes[i]) {
      return candidates[i];
    }
  }
  return null;
}

const kubernetesPrometheusResolution = createTtlCachedPromise(resolveKubernetesPrometheus, RESOLUTION_TTL_MS);

// Reset the cached datasource resolution (test seam).
export function resetKubernetesPrometheusResolution(): void {
  kubernetesPrometheusResolution.reset();
}

/** Overview counts via kube-state-metrics queries against the resolved datasource; throws when none has data. */
export async function fetchKubernetesOverview(): Promise<KubernetesOverview> {
  const ds = await kubernetesPrometheusResolution.get();
  if (!ds) {
    throw new Error(NO_KUBERNETES_DATA_ERROR);
  }
  const frames = await runInstantQueries(OVERVIEW_QUERIES, ds);
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    pods: readScalar(frames, 'pods') ?? 0,
    alertsFiring: readScalar(frames, 'alertsFiring'),
    unhealthyPods: readScalar(frames, 'unhealthyPods'),
    restarts1h: readScalar(frames, 'restarts1h'),
    notReadyNodes: readScalar(frames, 'notReadyNodes'),
  };
}

/** Cluster CPU over 24h (cAdvisor); throws when no datasource has Kubernetes data, null when the metric is absent. */
export async function fetchClusterCpuSeries(): Promise<FieldSparkline | null> {
  const ds = await kubernetesPrometheusResolution.get();
  if (!ds) {
    throw new Error(NO_KUBERNETES_DATA_ERROR);
  }
  const frames = await runRangeQuery('cpu', 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m]))', 24, ds);
  return readSeries(frames, 'cpu');
}
