import { escapeRegExp } from 'lodash';

import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type FieldSparkline,
  store,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { type KubernetesHomeFilters } from './kubernetesFilters';
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

// A count of matching entities is empty (null) when nothing matches, the same as when the metric
// is absent: the card shows a row only for a positive count, so the two need no telling apart.
export interface KubernetesHealth {
  alertsFiring: number | null; // null = no firing alerts or Prometheus evaluates no rules (hide the count)
  pendingPods: number | null; // pods Pending now and PENDING_CONSISTENCY_OFFSET ago
  crashLoopingPods: number | null; // pods with a container waiting in CrashLoopBackOff
  notReadyNodes: number | null; // nodes whose Ready condition is false or unknown
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

const clusterMatcher = (f: KubernetesHomeFilters): string | null =>
  f.cluster ? `cluster="${escapeLabelValue(f.cluster)}"` : null;

// Values are regex alternatives: regex-escape first, then string-literal-escape the result.
const valuesRegex = (values: string[]): string => values.map((v) => escapeLabelValue(escapeRegExp(v))).join('|');

const namespaceMatcher = (f: KubernetesHomeFilters): string | null =>
  f.namespaces?.length ? `namespace=~"${valuesRegex(f.namespaces)}"` : null;

const nodeMatcher = (f: KubernetesHomeFilters): string | null =>
  f.nodes?.length ? `node=~"${valuesRegex(f.nodes)}"` : null;

// '' (not '{}') when no matchers so unfiltered queries stay byte-identical to the historical strings.
const selector = (...matchers: Array<string | null>): string => {
  const active = matchers.filter(Boolean);
  return active.length ? `{${active.join(',')}}` : '';
};

// Pod-state metrics carry no node label: keep only pods whose kube_pod_info sits on a selected node.
const podNodeScope = (f: KubernetesHomeFilters): string =>
  f.nodes?.length
    ? ` and on (${PER_POD}) group by (${PER_POD}) (kube_pod_info${selector(clusterMatcher(f), nodeMatcher(f))})`
    : '';

// Node readiness is namespace-blind; when namespaces are selected, count only nodes hosting
// their pods so a healthy selection reads healthy even while unrelated nodes are down.
const nodeNamespaceScope = (f: KubernetesHomeFilters): string =>
  f.namespaces?.length
    ? ` and on (${PER_NODE}) group by (${PER_NODE}) (kube_pod_info${selector(clusterMatcher(f), namespaceMatcher(f), nodeMatcher(f))})`
    : '';

// refId -> portable kube-state-metrics PromQL, all instant. Clusters are those with node inventory
// right now and pods the Running|Pending ones: the same populations the Kubernetes Monitoring app
// counts, so the card and the app agree.
const inventoryQueries = (f: KubernetesHomeFilters): Record<string, string> => ({
  clusters: `count(group by (cluster) (kube_node_info${selector('cluster!=""', clusterMatcher(f), nodeMatcher(f))}))`,
  pods: `count(${present(PER_POD, `kube_pod_status_phase${selector('cluster!=""', 'phase=~"Running|Pending"', clusterMatcher(f), namespaceMatcher(f))}`)}${podNodeScope(f)})`,
});

// Every health signal is strictly scoped to the selection: a quiet selection must read healthy,
// which flips the card out of its needs-attention state.
const healthQueries = (f: KubernetesHomeFilters): Record<string, string> => {
  const pending = `kube_pod_status_phase${selector('phase="Pending"', clusterMatcher(f), namespaceMatcher(f))}`;
  return {
    pendingPods: `count(${present(PER_POD, pending)} and ${present(PER_POD, `${pending} offset ${PENDING_CONSISTENCY_OFFSET}`)}${podNodeScope(f)})`,
    crashLoopingPods: `count(${present(PER_POD, `kube_pod_container_status_waiting_reason${selector('reason="CrashLoopBackOff"', clusterMatcher(f), namespaceMatcher(f))}`)}${podNodeScope(f)})`,
    notReadyNodes: `count(${present(PER_NODE, `kube_node_status_condition${selector('condition="Ready",status=~"false|unknown"', clusterMatcher(f), nodeMatcher(f))}`)}${nodeNamespaceScope(f)})`,
  };
};

// Firing Kubernetes alert instances: the same alert-name allowlist as the Kubernetes Monitoring
// app, so the count matches its alerts page. Strict label matching: alerts without a selected
// namespace/node label are dropped, so a quiet selection shows zero alerts even while the wider
// fleet is firing.
const alertsMatcher = (f: KubernetesHomeFilters): string =>
  selector(
    'alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!=""',
    clusterMatcher(f),
    namespaceMatcher(f),
    nodeMatcher(f)
  );

// The Kubernetes Monitoring app gates on node inventory, and so does the cluster count above, so a
// datasource is detected and counted from the same metric. The lookback tolerates scrape gaps.
const NODE_PROBE = `count(last_over_time(kube_node_info{cluster!=""}[${KUBE_STATE_LOOKBACK}]))`;

/** True when any health signal counts something, false when all are clear, null when none answered. @lintignore */
export function hasHealthProblems(h: KubernetesHealth): boolean | null {
  if (h.alertsFiring === null && h.pendingPods === null && h.notReadyNodes === null && h.crashLoopingPods === null) {
    return null;
  }
  return (h.pendingPods ?? 0) + (h.notReadyNodes ?? 0) + (h.crashLoopingPods ?? 0) + (h.alertsFiring ?? 0) > 0;
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
  filters: KubernetesHomeFilters
): Promise<KubernetesInventory> {
  const frames = await runInstantQueries(inventoryQueries(filters), ds);
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    pods: readScalar(frames, 'pods') ?? 0,
  };
}

/** Health signals via kube-state-metrics and alert metrics, scoped to `filters`. */
export async function fetchKubernetesHealth(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  filters: KubernetesHomeFilters
): Promise<KubernetesHealth> {
  // Grafana-managed firing alerts live in the state-history target datasource under a
  // configurable metric name; hard-coding GRAFANA_ALERTS on the k8s datasource misses them.
  const grafanaMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  const grafanaAlertsUid = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
  const sameDatasource = !grafanaAlertsUid || grafanaAlertsUid === ds.uid;

  const alerts = alertsMatcher(filters);
  const queries: Record<string, string> = {
    ...healthQueries(filters),
    // Same datasource: union with `or` so identical series never double-count.
    alertsFiring: sameDatasource ? `count(ALERTS${alerts} or ${grafanaMetric}${alerts})` : `count(ALERTS${alerts})`,
  };

  const [frames, grafanaAlertsFiring] = await Promise.all([
    runInstantQueries(queries, ds),
    sameDatasource ? Promise.resolve(null) : fetchGrafanaManagedAlertCount(grafanaAlertsUid, grafanaMetric, alerts),
  ]);

  const dsAlertsFiring = readScalar(frames, 'alertsFiring');
  return {
    alertsFiring:
      dsAlertsFiring === null && grafanaAlertsFiring === null
        ? null
        : (dsAlertsFiring ?? 0) + (grafanaAlertsFiring ?? 0),
    pendingPods: readScalar(frames, 'pendingPods'),
    crashLoopingPods: readScalar(frames, 'crashLoopingPods'),
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

/** CPU over 24h (cAdvisor) scoped to `filters`; null when the metric is absent. */
export async function fetchClusterCpuSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>,
  filters: KubernetesHomeFilters
): Promise<FieldSparkline | null> {
  const frames = await runRangeQuery(
    'cpu',
    `sum(rate(container_cpu_usage_seconds_total${selector('container!=""', clusterMatcher(filters), namespaceMatcher(filters), nodeMatcher(filters))}[5m]))`,
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
  const read = async (refId: string, expr: string, label: string) => {
    const frames = await runInstantQueries({ [refId]: expr }, ds);
    return readLabelValues(frames, refId, label);
  };
  const [clusters, namespaces, nodes] = await Promise.allSettled([
    read('clusters', 'group by (cluster) (kube_node_info{cluster!=""})', 'cluster'),
    read('namespaces', 'group by (namespace) (kube_namespace_status_phase{cluster!=""})', 'namespace'),
    read('nodes', 'group by (node) (kube_node_info{cluster!=""})', 'node'),
  ]);
  return {
    clusters: clusters.status === 'fulfilled' ? clusters.value : null,
    namespaces: namespaces.status === 'fulfilled' ? namespaces.value : null,
    nodes: nodes.status === 'fulfilled' ? nodes.value : null,
  };
}
