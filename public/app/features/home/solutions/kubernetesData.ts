import { escapeRegExp } from 'lodash';

import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type FieldSparkline,
  store,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { getKubernetesFilters, type KubernetesHomeFilters } from './kubernetesFilters';
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

const clusterMatcher = (f: KubernetesHomeFilters): string | null =>
  f.cluster ? `cluster="${escapeLabelValue(f.cluster)}"` : null;

// Values are regex alternatives: regex-escape first, then string-literal-escape the result.
const namespaceRegex = (namespaces: string[]): string =>
  namespaces.map((n) => escapeLabelValue(escapeRegExp(n))).join('|');

const namespaceMatcher = (f: KubernetesHomeFilters): string | null =>
  f.namespaces?.length ? `namespace=~"${namespaceRegex(f.namespaces)}"` : null;

// Trailing empty alternative also matches series with no namespace label: cluster-level alerts stay counted.
const alertNamespaceMatcher = (f: KubernetesHomeFilters): string | null =>
  f.namespaces?.length ? `namespace=~"${namespaceRegex(f.namespaces)}|"` : null;

// '' (not '{}') when no matchers so unfiltered queries stay byte-identical to the historical strings.
const selector = (...matchers: Array<string | null>): string => {
  const active = matchers.filter(Boolean);
  return active.length ? `{${active.join(',')}}` : '';
};

// refId -> portable kube-state-metrics PromQL: inventory uses last_over_time[24h], health stats are instant vectors.
const inventoryQueries = (f: KubernetesHomeFilters): Record<string, string> => ({
  clusters: `count(group by (cluster) (last_over_time(kube_node_info${selector(clusterMatcher(f))}[${KUBE_STATE_LOOKBACK}])))`,
  pods: `count(group by (cluster, namespace, pod) (last_over_time(kube_pod_info${selector(clusterMatcher(f), namespaceMatcher(f))}[${KUBE_STATE_LOOKBACK}])))`,
});

// Clusters and nodes are not namespaced, so their signals ignore the namespace filter.
const healthQueries = (f: KubernetesHomeFilters): Record<string, string> => ({
  unhealthyPods: `sum(kube_pod_status_phase${selector('phase=~"Pending|Failed|Unknown"', clusterMatcher(f), namespaceMatcher(f))})`,
  restarts1h: `sum(increase(kube_pod_container_status_restarts_total${selector(clusterMatcher(f), namespaceMatcher(f))}[1h]))`,
  notReadyNodes: `sum(kube_node_status_condition${selector('condition="Ready",status=~"false|unknown"', clusterMatcher(f))})`,
});

// Firing alert instances scoped to Kubernetes workloads; heartbeats excluded.
const alertsMatcher = (f: KubernetesHomeFilters): string =>
  selector(
    'alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""',
    clusterMatcher(f),
    alertNamespaceMatcher(f)
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

/** Cluster and pod counts via kube-state-metrics. */
export async function fetchKubernetesInventory(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<KubernetesInventory> {
  const frames = await runInstantQueries(inventoryQueries(await getKubernetesFilters()), ds);
  return {
    clusters: readScalar(frames, 'clusters') ?? 0,
    pods: readScalar(frames, 'pods') ?? 0,
  };
}

/** Health signals via kube-state-metrics and alert metrics. */
export async function fetchKubernetesHealth(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<KubernetesHealth> {
  // Grafana-managed firing alerts live in the state-history target datasource under a
  // configurable metric name; hard-coding GRAFANA_ALERTS on the k8s datasource misses them.
  const grafanaMetric = config.unifiedAlerting.stateHistory?.prometheusMetricName ?? 'GRAFANA_ALERTS';
  const grafanaAlertsUid = config.unifiedAlerting.stateHistory?.prometheusTargetDatasourceUID;
  const sameDatasource = !grafanaAlertsUid || grafanaAlertsUid === ds.uid;

  const filters = await getKubernetesFilters();
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

/** Cluster CPU over 24h (cAdvisor); null when the metric is absent. */
export async function fetchClusterCpuSeries(
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<FieldSparkline | null> {
  const filters = await getKubernetesFilters();
  const frames = await runRangeQuery(
    'cpu',
    `sum(rate(container_cpu_usage_seconds_total${selector('container!=""', clusterMatcher(filters), namespaceMatcher(filters))}[5m]))`,
    24,
    ds
  );
  return readSeries(frames, 'cpu');
}

export interface KubernetesFilterOptions {
  /** null = discovery failed for this picker (options unavailable, manual entry still works). */
  clusters: string[] | null;
  namespaces: string[] | null;
}

/**
 * Label values feeding the filter pickers. The two discovery queries run separately —
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
  const [clusters, namespaces] = await Promise.allSettled([
    read('clusters', `group by (cluster) (last_over_time(kube_node_info[${KUBE_STATE_LOOKBACK}]))`, 'cluster'),
    read(
      'namespaces',
      `group by (namespace) (last_over_time(kube_namespace_status_phase[${KUBE_STATE_LOOKBACK}]))`,
      'namespace'
    ),
  ]);
  return {
    clusters: clusters.status === 'fulfilled' ? clusters.value : null,
    namespaces: namespaces.status === 'fulfilled' ? namespaces.value : null,
  };
}
