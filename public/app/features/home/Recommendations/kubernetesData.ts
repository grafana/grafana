import { type DataSourceInstanceSettings, type FieldSparkline, store } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';

export const KUBERNETES_APP_ID = 'grafana-k8s-app';

export interface KubernetesOverview {
  clusters: number;
  pods: number;
  alertsFiring: number | null; // null = no firing alerts or Prometheus evaluates no rules (hide the count)
  unhealthyPods: number | null; // null = metric absent (hide the row); 0 = all healthy
  restarts1h: number | null; // null = metric absent (hide the row)
  notReadyNodes: number | null; // null = metric absent (hide the row); 0 = all Ready
}

const KUBE_STATE_LOOKBACK = '24h';

// refId -> portable kube-state-metrics PromQL. No recording rules: works on any Prometheus scraping
// kube-state-metrics. Instant vectors are the source of truth for live clusters — Prometheus
// staleness markers drop deleted pods/nodes, so churn does not inflate counts or pin stale
// Pending/Failed/NotReady states. The `or last_over_time[24h]` arm fires only when the instant
// vector is empty (seeded/demo samples not continuously scraped, past the 5m instant lookback),
// keeping that data rendering. `group by (...)` dedupes series across replicas before count().
const OVERVIEW_QUERIES: Record<string, string> = {
  clusters: `count(group by (cluster) (kube_node_info)) or count(group by (cluster) (last_over_time(kube_node_info[${KUBE_STATE_LOOKBACK}])))`,
  pods: `count(group by (cluster, namespace, pod) (kube_pod_info)) or count(group by (cluster, namespace, pod) (last_over_time(kube_pod_info[${KUBE_STATE_LOOKBACK}])))`,
  unhealthyPods: `sum(kube_pod_status_phase{phase=~"Pending|Failed|Unknown"}) or sum(last_over_time(kube_pod_status_phase{phase=~"Pending|Failed|Unknown"}[${KUBE_STATE_LOOKBACK}]))`,
  restarts1h: 'sum(increase(kube_pod_container_status_restarts_total[1h]))',
  notReadyNodes: `sum(kube_node_status_condition{condition="Ready",status=~"false|unknown"}) or sum(last_over_time(kube_node_status_condition{condition="Ready",status=~"false|unknown"}[${KUBE_STATE_LOOKBACK}]))`,
  // ALERTS = datasource-managed rules; GRAFANA_ALERTS = Grafana-managed state (Prometheus state
  // historian, same alertstate="firing"). Watchdog/InfoInhibitor are kube-prometheus-stack's
  // always-firing heartbeats — excluded (ALERTS-only). count() over no matches is empty → null.
  alertsFiring:
    'count(ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor"} or GRAFANA_ALERTS{alertstate="firing"})',
};

// Cap the probe fan-out on orgs with many Prometheus datasources: only the first 10 candidates
// (in priority order) are probed per page load.
const MAX_PROBED_DATASOURCES = 10;

// Never user-visible (useAsync swallows it) — no i18n. Tests assert this exact message.
const NO_KUBERNETES_DATA_ERROR = 'No Prometheus datasource with Kubernetes data';

// Mirrors how the k8s app detects namespaces (kube_namespace_status_phase behind its
// "No namespaces detected" empty state), with the same lookback tolerance as OVERVIEW_QUERIES.
// A bare count() suffices for a has-data probe; grouping by namespace would only add evaluation
// cost across up to MAX_PROBED_DATASOURCES datasources.
const NAMESPACE_PROBE = `count(kube_namespace_status_phase) or count(last_over_time(kube_namespace_status_phase[${KUBE_STATE_LOOKBACK}]))`;

// True when the available health signals show a problem, false when they are all clear, null when
// NONE are available (e.g. Prometheus scrapes only inventory metrics) — absence of data is not health.
export function hasHealthProblems(o: KubernetesOverview): boolean | null {
  if (o.alertsFiring === null && o.unhealthyPods === null && o.notReadyNodes === null && o.restarts1h === null) {
    return null;
  }
  // null counts as 0 so a partial metric set still verdicts.
  return (o.unhealthyPods ?? 0) + (o.notReadyNodes ?? 0) + (o.restarts1h ?? 0) + (o.alertsFiring ?? 0) > 0;
}

// The k8s app's PrometheusPicker persists the user's datasource choice under this key
// (grafana-k8s-app src/constants.ts K8S_STORAGE_KEY). Reading it lets the homepage query the same
// Prometheus the app itself shows instead of guessing default-else-first.
const K8S_APP_STORAGE_KEY = 'grafana.k8s-app.navigation.storage';

// Exact provisioned names of Grafana Cloud's utility Prometheus datasources (billing/ML) — never
// where kube-state-metrics lives. Exact match, not substring: user datasources may contain "usage".
const CLOUD_UTILITY_DATASOURCE_NAMES: Record<string, true> = {
  'grafanacloud-usage': true,
  'grafanacloud-ml-metrics': true,
};

// Order Prometheus datasources by how likely they are to hold this org's kube-state-metrics:
// the k8s app's stored choice first, then — skipping the cloud utility datasources unless nothing
// else exists — the default, then list order.
function orderedCandidates(): DataSourceInstanceSettings[] {
  const list = getDataSourceSrv().getList({ type: 'prometheus' });
  let promName: string | undefined;
  try {
    // store.getObject absorbs a missing key and corrupt JSON (returns the default); the try guards
    // the rare case where localStorage access itself throws (privacy mode) — fall through then.
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

// A datasource "has Kubernetes data" when it detects namespaces — the same signal the k8s app's
// empty state keys on. A query error (unreachable, auth) counts as no data: an unusable
// datasource must not win the probe.
async function hasKubernetesNamespaces(ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>): Promise<boolean> {
  try {
    const frames = await runInstantQueries({ namespaces: NAMESPACE_PROBE }, ds);
    return (readScalar(frames, 'namespaces') ?? 0) > 0;
  } catch {
    return false;
  }
}

// One resolution per page load: both fetchers await the same promise, so the probe fan-out runs
// once and the overview + sparkline always query the same datasource.
let resolution: Promise<DataSourceInstanceSettings | null> | undefined;

// Reset the cached datasource resolution (test seam).
export function resetKubernetesPrometheusResolution(): void {
  resolution = undefined;
}

// Resolve the Prometheus datasource to show Kubernetes stats from: fire a namespace probe at every
// candidate (in parallel), then settle on the highest-priority candidate whose probe found data.
// null when none has Kubernetes data — callers treat that as "not enabled".
function resolveKubernetesPrometheus(): Promise<DataSourceInstanceSettings | null> {
  resolution ??= (async () => {
    const candidates = orderedCandidates().slice(0, MAX_PROBED_DATASOURCES);
    const probes = candidates.map((ds) => hasKubernetesNamespaces(ds));
    for (let i = 0; i < candidates.length; i++) {
      // Await in priority order: a candidate wins only once every higher-priority probe came back
      // empty, so a slow high-priority probe (worst case the 30s query timeout) delays — never
      // changes — the outcome. Priority is deliberately favored over fastest-success latency.
      if (await probes[i]) {
        return candidates[i];
      }
    }
    return null;
  })();
  return resolution;
}

/**
 * Resolve overview counts from Prometheus rather than a plugin REST endpoint: the k8s app has no
 * "summary" API, so we run portable kube-state-metrics instant queries directly against the
 * datasource {@link resolveKubernetesPrometheus} settles on (the k8s app's stored choice or the
 * first non-utility/default candidate whose namespace probe finds data), throwing when no
 * datasource has Kubernetes data — the caller then omits the entry.
 */
export async function fetchKubernetesOverview(): Promise<KubernetesOverview> {
  const ds = await resolveKubernetesPrometheus();
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

/**
 * Aggregate cluster CPU usage over the last 24h as a sparkline series. Portable cAdvisor PromQL (no
 * recording rules). Two miss modes: throws when no datasource has Kubernetes data (the same shared
 * {@link resolveKubernetesPrometheus} resolution the overview uses), and returns null when the
 * resolved datasource lacks the cAdvisor CPU metric — so the caller omits only the sparkline.
 */
export async function fetchClusterCpuSeries(): Promise<FieldSparkline | null> {
  const ds = await resolveKubernetesPrometheus();
  if (!ds) {
    throw new Error(NO_KUBERNETES_DATA_ERROR);
  }
  const frames = await runRangeQuery('cpu', 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m]))', 24, ds);
  return readSeries(frames, 'cpu');
}
