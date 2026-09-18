import { escapeRegExp } from 'lodash';

import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type FieldSparkline,
  store,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { type KubernetesFilterValues } from './kubernetesFilters';
import {
  createTtlCachedPromise,
  findDatasourceWithData,
  listProbeCandidates,
  PROBE_TIMEOUT_MS,
  PROBE_TTL_MS,
} from './probeUtils';
import { readLabelValues, readScalar, readSeries, runInstantQueries, runRangeQuery } from './promQuery';

/** Kubernetes Monitoring app plugin ID. @lintignore */
export const KUBERNETES_APP_ID = 'grafana-k8s-app';

export interface KubernetesInventory {
  clusters: number;
  pods: number;
}

// An empty instant vector (nothing matched, or the metric is absent) reads as 0.
export interface KubernetesHealth {
  alertsFiring: number;
  pendingPods: number; // pods Pending now and PENDING_CONSISTENCY_OFFSET ago
  crashLoopingPods: number; // pods with a container waiting in CrashLoopBackOff
  notReadyNodes: number; // nodes whose Ready condition is false or unknown
}

// Lookback for the datasource probe only: "seen recently", tolerating scrape gaps.
const KUBE_STATE_LOOKBACK = '24h';

// A pod counts as pending only when it was already Pending this long ago, so transient scheduling
// never surfaces. Same window as the Kubernetes Monitoring app.
const PENDING_CONSISTENCY_OFFSET = '10m';

// Entities are collapsed to one series each before counting, so HA kube-state-metrics replicas
// (two series per node or pod) never double count. Mirrors the Kubernetes Monitoring app's queries.
const PER_POD = 'cluster, namespace, pod';
const PER_NODE = 'cluster, node';
const present = (by: string, expr: string): string => `max by (${by}) (${expr}) == 1`;

// PromQL string-literal escaping for label matcher values (custom user input; control chars would break the literal).
const escapeLabelValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

// Values are regex alternatives: regex-escape first, then string-literal-escape the result.
const valuesRegex = (values: string[]): string => values.map((v) => escapeLabelValue(escapeRegExp(v))).join('|');

const selector = (...matchers: Array<string | null>): string => `{${matchers.filter(Boolean).join(',')}}`;

// Keeps only the entities that kube_pod_info places inside the selection.
const podInfoJoin = (by: string, ...matchers: Array<string | null>): string =>
  ` and on (${by}) group by (${by}) (kube_pod_info${selector(...matchers)})`;

/** One filter snapshot as PromQL matcher fragments, escaped once per fetch. */
interface Scope {
  /**
   * `cluster="…"` for a selected cluster, else `cluster!=""`: the probe gates on the label, so
   * every population demands it.
   */
  cluster: string;
  namespace: string | null;
  node: string | null;
  /** Pod-state metrics carry no node label: keeps only pods kube_pod_info places on a selected node. */
  podsOnNodes: string;
  /**
   * Node readiness is namespace-blind: keeps only nodes hosting the selected namespaces' pods, so a
   * healthy selection reads healthy even while unrelated nodes are down.
   */
  nodesHostingNamespaces: string;
}

const scope = (f: KubernetesFilterValues): Scope => {
  const cluster = f.cluster ? `cluster="${escapeLabelValue(f.cluster)}"` : 'cluster!=""';
  const namespace = f.namespaces?.length ? `namespace=~"${valuesRegex(f.namespaces)}"` : null;
  const node = f.nodes?.length ? `node=~"${valuesRegex(f.nodes)}"` : null;
  return {
    cluster,
    namespace,
    node,
    podsOnNodes: node ? podInfoJoin(PER_POD, cluster, node) : '',
    nodesHostingNamespaces: namespace ? podInfoJoin(PER_NODE, cluster, namespace, node) : '',
  };
};

// refId -> portable kube-state-metrics PromQL, all instant. Clusters are those with node inventory
// right now and pods the Running|Pending ones: the same populations the Kubernetes Monitoring app
// counts, so the card and the app agree.
const inventoryQueries = (s: Scope): Record<string, string> => ({
  clusters: `count(group by (cluster) (kube_node_info${selector(s.cluster, s.node)}))`,
  pods: `count(${present(PER_POD, `kube_pod_status_phase${selector(s.cluster, 'phase=~"Running|Pending"', s.namespace)}`)}${s.podsOnNodes})`,
});

// Every health signal is strictly scoped to the selection: a quiet selection must read healthy,
// which flips the card out of its needs-attention state.
const healthQueries = (s: Scope): Record<string, string> => {
  const pending = `kube_pod_status_phase${selector('phase="Pending"', s.cluster, s.namespace)}`;
  return {
    pendingPods: `count(${present(PER_POD, pending)} and ${present(PER_POD, `${pending} offset ${PENDING_CONSISTENCY_OFFSET}`)}${s.podsOnNodes})`,
    crashLoopingPods: `count(${present(PER_POD, `kube_pod_container_status_waiting_reason${selector('reason="CrashLoopBackOff"', s.cluster, s.namespace)}`)}${s.podsOnNodes})`,
    notReadyNodes: `count(${present(PER_NODE, `kube_node_status_condition${selector('condition="Ready",status=~"false|unknown"', s.cluster, s.node)}`)}${s.nodesHostingNamespaces})`,
  };
};

// Firing Kubernetes alert instances: the same alert-name allowlist as the Kubernetes Monitoring
// app, so the count matches its alerts page. Strict label matching: alerts without a selected
// namespace/node label are dropped, so a quiet selection shows zero alerts even while the wider
// fleet is firing.
const alertsMatcher = (s: Scope): string =>
  selector('alertstate="firing"', 'alertname=~"(Kube.*|CPUThrottlingHigh)"', s.cluster, s.namespace, s.node);

// The Kubernetes Monitoring app gates on node inventory, and so does the cluster count above, so a
// datasource is detected and counted from the same metric. The lookback tolerates scrape gaps.
const NODE_PROBE = `count(last_over_time(kube_node_info{cluster!=""}[${KUBE_STATE_LOOKBACK}]))`;

/** True when any health signal counts something. @lintignore */
export function hasHealthProblems(h: KubernetesHealth): boolean {
  return h.pendingPods + h.notReadyNodes + h.crashLoopingPods + h.alertsFiring > 0;
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
async function hasKubernetesNodes(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  signal?: AbortSignal
): Promise<boolean> {
  const frames = await runInstantQueries({ probe: NODE_PROBE }, ds, { timeoutMs: PROBE_TIMEOUT_MS, signal });
  return (readScalar(frames, 'probe') ?? 0) > 0;
}

// The stored choice is moved to the front before the scan caps the list.
async function resolveKubernetesPrometheus(): Promise<DataSourceInstanceListItem | null> {
  return findDatasourceWithData(await orderedCandidates(), hasKubernetesNodes);
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

/** Cluster and pod counts via kube-state-metrics, scoped to `filters`. */
export async function fetchKubernetesInventory(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  filters: KubernetesFilterValues
): Promise<KubernetesInventory> {
  const frames = await runInstantQueries(inventoryQueries(scope(filters)), ds);
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    pods: readScalar(frames, 'pods') ?? 0,
  };
}

/** Health signals via kube-state-metrics and alert metrics, scoped to `filters`. */
export async function fetchKubernetesHealth(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  filters: KubernetesFilterValues
): Promise<KubernetesHealth> {
  // Grafana-managed firing alerts live in the state-history target datasource under a
  // configurable metric name; hard-coding GRAFANA_ALERTS on the k8s datasource misses them.
  const grafanaMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  const grafanaAlertsUid = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
  const sameDatasource = !grafanaAlertsUid || grafanaAlertsUid === ds.uid;

  const s = scope(filters);
  const alerts = alertsMatcher(s);
  const queries: Record<string, string> = {
    ...healthQueries(s),
    // Same datasource: union with `or` so identical series never double-count.
    alertsFiring: sameDatasource ? `count(ALERTS${alerts} or ${grafanaMetric}${alerts})` : `count(ALERTS${alerts})`,
  };

  const [frames, grafanaAlertsFiring] = await Promise.all([
    runInstantQueries(queries, ds),
    sameDatasource ? 0 : fetchGrafanaManagedAlertCount(grafanaAlertsUid, grafanaMetric, alerts),
  ]);

  return {
    alertsFiring: (readScalar(frames, 'alertsFiring') ?? 0) + grafanaAlertsFiring,
    pendingPods: readScalar(frames, 'pendingPods') ?? 0,
    crashLoopingPods: readScalar(frames, 'crashLoopingPods') ?? 0,
    notReadyNodes: readScalar(frames, 'notReadyNodes') ?? 0,
  };
}

// A broken/absent state-history datasource must not blank the whole health row: fail to 0.
async function fetchGrafanaManagedAlertCount(uid: string, metric: string, matcher: string): Promise<number> {
  try {
    const frames = await runInstantQueries(
      { grafanaAlertsFiring: `count(${metric}${matcher})` },
      { uid, type: 'prometheus' }
    );
    return readScalar(frames, 'grafanaAlertsFiring') ?? 0;
  } catch {
    return 0;
  }
}

/** CPU over 24h (cAdvisor) scoped to `filters`; null when the metric is absent. */
export async function fetchClusterCpuSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  filters: KubernetesFilterValues
): Promise<FieldSparkline | null> {
  const s = scope(filters);
  const frames = await runRangeQuery(
    'cpu',
    `sum(rate(container_cpu_usage_seconds_total${selector('container!=""', s.cluster, s.namespace, s.node)}[5m]))`,
    24,
    ds
  );
  return readSeries(frames, 'cpu');
}

export interface KubernetesFilterOptions {
  /** null = discovery failed for this picker (options unavailable, manual entry still works). */
  clusters: string[] | null;
  namespaces: string[] | null;
  nodes: string[] | null;
}

/**
 * Label values feeding the filter pickers, from entities present right now so a picked value
 * always matches the instant inventory. The discovery queries run separately —
 * `runInstantQueries` with `partial` silently drops failed refIds, and a per-picker failure
 * must stay visible to the modal.
 */
export async function fetchKubernetesFilterOptions(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<KubernetesFilterOptions> {
  const read = (refId: string, expr: string, label: string) =>
    runInstantQueries({ [refId]: expr }, ds)
      .then((frames) => readLabelValues(frames, refId, label))
      .catch(() => null);
  const [clusters, namespaces, nodes] = await Promise.all([
    read('clusters', 'group by (cluster) (kube_node_info{cluster!=""})', 'cluster'),
    read('namespaces', 'group by (namespace) (kube_namespace_status_phase{cluster!=""})', 'namespace'),
    read('nodes', 'group by (node) (kube_node_info{cluster!=""})', 'node'),
  ]);
  return { clusters, namespaces, nodes };
}
