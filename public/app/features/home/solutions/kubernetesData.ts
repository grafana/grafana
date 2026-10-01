import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type FieldSparkline,
  escapeRegex,
  store,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  createTtlCachedPromise,
  findDatasourceWithData,
  listProbeCandidates,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
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

/** Label matchers narrowing every Kubernetes query. A field left empty ('' / []) does not narrow. */
export interface KubernetesScope {
  cluster: string;
  namespaces: string[];
  nodes: string[];
}

export function hasSelection(scope: KubernetesScope): boolean {
  return scope.cluster !== '' || scope.namespaces.length > 0 || scope.nodes.length > 0;
}

// Lookback for the inventory queries and the namespace probe: "seen recently", tolerating scrape gaps.
const KUBE_STATE_LOOKBACK = '24h';

type ScopeLabel = 'cluster' | 'namespace' | 'node';
// Labels each series family carries: pod-level metrics (kube_pod_status_phase, restarts, cAdvisor) have
// no node label, node metrics (kube_node_info, kube_node_status_condition) no namespace, while
// kube_pod_info and ALERTS carry all three.
const POD_LABELS: ScopeLabel[] = ['cluster', 'namespace'];
const NODE_LABELS: ScopeLabel[] = ['cluster', 'node'];
const ALL_LABELS: ScopeLabel[] = ['cluster', 'namespace', 'node'];

// PromQL string literal: PromQL only accepts Go escapes, so backslash, quote and newline are escaped.
// Regex alternations escape RE2 metacharacters first; a dot in a node name therefore renders as `\\.`
// in the query text (the string escape of the regex escape).
const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
const anyOf = (values: string[]) => quote(values.map(escapeRegex).join('|'));

// Matchers for the scope fields that `labels` carry, in cluster, namespace, node order.
function matchers(scope: KubernetesScope | null, labels: ScopeLabel[]): string[] {
  if (!scope) {
    return [];
  }
  const result: string[] = [];
  if (labels.includes('cluster') && scope.cluster) {
    result.push(`cluster=${quote(scope.cluster)}`);
  }
  if (labels.includes('namespace') && scope.namespaces.length > 0) {
    result.push(`namespace=~${anyOf(scope.namespaces)}`);
  }
  if (labels.includes('node') && scope.nodes.length > 0) {
    result.push(`node=~${anyOf(scope.nodes)}`);
  }
  return result;
}

// `{fixed,scoped}` joined without spaces, or '' when both are empty so unscoped metrics stay bare.
function selector(scope: KubernetesScope | null, labels: ScopeLabel[], fixed: string[] = []): string {
  const all = [...fixed, ...matchers(scope, labels)];
  return all.length > 0 ? `{${all.join(',')}}` : '';
}

// Pod-level metrics carry no node label: keep the series whose pod kube_pod_info places on a selected
// node. `window` widens membership to pods seen over that range, for expressions that already look back.
function onSelectedNodes(expr: string, scope: KubernetesScope | null, window?: string): string {
  if (!scope?.nodes.length) {
    return expr;
  }
  const members = `kube_pod_info${selector(scope, ALL_LABELS)}`;
  return `${expr} and on (cluster, namespace, pod) ${window ? `last_over_time(${members}[${window}])` : members}`;
}

// refId -> portable kube-state-metrics PromQL: inventory uses last_over_time[24h], health stats are instant vectors.
function inventoryQueries(scope: KubernetesScope | null): Record<string, string> {
  // kube_node_info carries cluster and node but no namespace: only a namespace selection needs pod
  // membership, so it alone switches the cluster count to kube_pod_info (clusters running pods there).
  const clusterSource = scope?.namespaces.length
    ? `kube_pod_info${selector(scope, ALL_LABELS)}`
    : `kube_node_info${selector(scope, NODE_LABELS)}`;
  return {
    clusters: `count(group by (cluster) (last_over_time(${clusterSource}[${KUBE_STATE_LOOKBACK}])))`,
    pods: `count(group by (cluster, namespace, pod) (last_over_time(kube_pod_info${selector(scope, ALL_LABELS)}[${KUBE_STATE_LOOKBACK}])))`,
  };
}

function healthQueries(scope: KubernetesScope | null): Record<string, string> {
  return {
    unhealthyPods: `sum(${onSelectedNodes(
      `kube_pod_status_phase${selector(scope, POD_LABELS, ['phase=~"Pending|Failed|Unknown"'])}`,
      scope
    )})`,
    // Membership over the same hour, so a pod deleted after restarting still counts like it does unscoped.
    restarts1h: `sum(${onSelectedNodes(
      `increase(kube_pod_container_status_restarts_total${selector(scope, POD_LABELS)}[1h])`,
      scope,
      '1h'
    )})`,
    // Nodes are cluster-level: a namespace selection does not narrow them.
    notReadyNodes: `sum(kube_node_status_condition${selector(scope, NODE_LABELS, ['condition="Ready"', 'status=~"false|unknown"'])})`,
  };
}

// Firing alert instances scoped to Kubernetes workloads; heartbeats excluded. Alerts carry their rule's
// labels, so an alert counts only when it has every selected label with a matching value: a namespace
// selection drops node-level alerts, a node selection drops pod alerts that carry no node label.
// Label-only scoping is deliberate: alerts have no join key to pods.
function alertsMatcher(scope: KubernetesScope | null): string {
  const all = [
    'alertstate="firing"',
    'alertname!~"Watchdog|InfoInhibitor"',
    'cluster!=""',
    ...matchers(scope, ALL_LABELS),
  ];
  return `{${all.join(', ')}}`;
}

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
  const ordered = await listProbeCandidates('prometheus');
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

// Single attempt inside the probe timeout; errors read as no data in the parallel scan.
async function hasKubernetesNamespaces(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  signal?: AbortSignal
): Promise<boolean> {
  const frames = await runInstantQueries({ namespaces: NAMESPACE_PROBE }, ds, { timeoutMs: PROBE_TIMEOUT_MS, signal });
  return (readScalar(frames, 'namespaces') ?? 0) > 0;
}

// The stored choice is moved to the front before the scan caps the list.
async function resolveKubernetesPrometheus(): Promise<DataSourceInstanceListItem | null> {
  return findDatasourceWithData(await orderedCandidates(), hasKubernetesNamespaces);
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

/** Cluster and pod counts via kube-state-metrics; `scope` null = the whole fleet. */
export async function fetchKubernetesInventory(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  scope: KubernetesScope | null
): Promise<KubernetesInventory> {
  const frames = await runInstantQueries(inventoryQueries(scope), ds);
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    pods: readScalar(frames, 'pods') ?? 0,
  };
}

/** Health signals via kube-state-metrics and alert metrics; `scope` null = the whole fleet. */
export async function fetchKubernetesHealth(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  scope: KubernetesScope | null
): Promise<KubernetesHealth> {
  // Grafana-managed firing alerts live in the state-history target datasource under a
  // configurable metric name; hard-coding GRAFANA_ALERTS on the k8s datasource misses them.
  const grafanaMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  const grafanaAlertsUid = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
  const sameDatasource = !grafanaAlertsUid || grafanaAlertsUid === ds.uid;
  const matcher = alertsMatcher(scope);

  const queries: Record<string, string> = {
    ...healthQueries(scope),
    // Same datasource: union with `or` so identical series never double-count.
    alertsFiring: sameDatasource ? `count(ALERTS${matcher} or ${grafanaMetric}${matcher})` : `count(ALERTS${matcher})`,
  };

  const [frames, grafanaAlertsFiring] = await Promise.all([
    runInstantQueries(queries, ds),
    sameDatasource ? Promise.resolve(null) : fetchGrafanaManagedAlertCount(grafanaAlertsUid, grafanaMetric, matcher),
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

// A broken/absent state-history datasource must not blank the whole health row: fail to null. The
// state-history datasource holds the same rule labels, so the scoped matcher applies there too.
async function fetchGrafanaManagedAlertCount(uid: string, metric: string, matcher: string): Promise<number | null> {
  try {
    const frames = await runInstantQueries(
      { grafanaAlertsFiring: `count(${metric}${matcher})` },
      { uid, type: 'prometheus' }
    );
    return readScalar(frames, 'grafanaAlertsFiring');
  } catch {
    return null;
  }
}

/** Cluster CPU over 24h (cAdvisor); null when the metric is absent. `scope` null = the whole fleet. */
export async function fetchClusterCpuSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  scope: KubernetesScope | null
): Promise<FieldSparkline | null> {
  const cpu = `sum(${onSelectedNodes(
    `rate(container_cpu_usage_seconds_total${selector(scope, POD_LABELS, ['container!=""'])}[5m])`,
    scope
  )})`;
  const frames = await runRangeQuery('cpu', cpu, 24, ds);
  return readSeries(frames, 'cpu');
}
