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

export interface KubernetesHealth {
  alertsFiring: number | null; // null = no firing alerts or Prometheus evaluates no rules (hide the count)
  unhealthyPods: number | null; // null = metric absent (hide the row); 0 = all healthy
  restarts1h: number | null; // null = metric absent (hide the row)
  notReadyNodes: number | null; // null = metric absent (hide the row); 0 = all Ready
}

// Lookback for the inventory queries and the namespace probe: "seen recently", tolerating scrape gaps.
const KUBE_STATE_LOOKBACK = '24h';

// PromQL string-literal escaping for label matcher values (custom user input; control chars would break the literal).
const escapeLabelValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

// Values are regex alternatives: regex-escape first, then string-literal-escape the result.
const valuesRegex = (values: string[]): string => values.map((v) => escapeLabelValue(escapeRegExp(v))).join('|');

// Label matchers as a selector; none at all leaves the bare metric name.
const selector = (...matchers: Array<string | null>): string => {
  const present = matchers.filter(Boolean);
  return present.length ? `{${present.join(',')}}` : '';
};

// Join keys identifying one pod or one node across kube-state-metrics series.
const PER_POD = 'cluster, namespace, pod';
const PER_NODE = 'cluster, node';

// Keeps only the entities that kube_pod_info places inside the selection.
const podInfoJoin = (by: string, ...matchers: Array<string | null>): string =>
  ` and on (${by}) group by (${by}) (kube_pod_info${selector(...matchers)})`;

/** One filter snapshot as PromQL matcher fragments, escaped once per fetch. */
interface Scope {
  /** `cluster="…"` for a selected cluster; null leaves the metric fleet-wide. */
  cluster: string | null;
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
  const cluster = f.cluster ? `cluster="${escapeLabelValue(f.cluster)}"` : null;
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

// refId -> portable kube-state-metrics PromQL: inventory uses last_over_time[24h], health stats are
// instant vectors. kube_pod_info carries the node label, so the pod count needs no join.
const inventoryQueries = (s: Scope): Record<string, string> => ({
  clusters: `count(group by (cluster) (last_over_time(kube_node_info${selector(s.cluster, s.node)}[${KUBE_STATE_LOOKBACK}])))`,
  pods: `count(group by (${PER_POD}) (last_over_time(kube_pod_info${selector(s.cluster, s.namespace, s.node)}[${KUBE_STATE_LOOKBACK}])))`,
});

// Every health signal is strictly scoped to the selection: a quiet selection must read healthy,
// which flips the card out of its needs-attention state.
const healthQueries = (s: Scope): Record<string, string> => ({
  unhealthyPods: `sum(kube_pod_status_phase${selector('phase=~"Pending|Failed|Unknown"', s.cluster, s.namespace)}${s.podsOnNodes})`,
  restarts1h: `sum(increase(kube_pod_container_status_restarts_total${selector(s.cluster, s.namespace)}[1h])${s.podsOnNodes})`,
  notReadyNodes: `sum(kube_node_status_condition${selector('condition="Ready",status=~"false|unknown"', s.cluster, s.node)}${s.nodesHostingNamespaces})`,
});

// Firing alert instances scoped to Kubernetes workloads; heartbeats excluded. Strict label
// matching: alerts without a selected namespace/node label are dropped, so a quiet selection shows
// zero alerts even while the wider fleet is firing.
const alertsMatcher = (s: Scope): string =>
  selector(
    'alertstate="firing"',
    'alertname!~"Watchdog|InfoInhibitor"',
    s.cluster ?? 'cluster!=""',
    s.namespace,
    s.node
  );

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
    sameDatasource ? Promise.resolve(null) : fetchGrafanaManagedAlertCount(grafanaAlertsUid, grafanaMetric, alerts),
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

/** Cluster CPU over 24h (cAdvisor) scoped to `filters`; null when the metric is absent. */
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
 * Label values feeding the filter pickers, from entities seen within the inventory lookback so a
 * picked value always matches the inventory. The discovery queries run separately —
 * `runInstantQueries` with `partial` silently drops failed refIds, and a per-picker failure
 * must stay visible to the modal.
 */
export async function fetchKubernetesFilterOptions(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<KubernetesFilterOptions> {
  // The label doubles as the refId.
  const read = (label: string, expr: string) =>
    runInstantQueries({ [label]: expr }, ds)
      .then((frames) => readLabelValues(frames, label, label))
      .catch(() => null);
  const [clusters, namespaces, nodes] = await Promise.all([
    read('cluster', `group by (cluster) (last_over_time(kube_node_info[${KUBE_STATE_LOOKBACK}]))`),
    read('namespace', `group by (namespace) (last_over_time(kube_namespace_status_phase[${KUBE_STATE_LOOKBACK}]))`),
    read('node', `group by (node) (last_over_time(kube_node_info[${KUBE_STATE_LOOKBACK}]))`),
  ]);
  return { clusters, namespaces, nodes };
}
