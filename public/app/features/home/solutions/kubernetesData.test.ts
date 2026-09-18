import { NEVER, of } from 'rxjs';

import {
  createDataFrame,
  type DataFrame,
  type DataSourceInstanceListItem,
  FieldType,
  LoadingState,
  type PanelData,
  type QueryRunner,
} from '@grafana/data';
import { type BackendSrv, config, createQueryRunner, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  fetchClusterCpuSeries,
  fetchKubernetesFilterOptions,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
  resetKubernetesPrometheusResolution,
} from './kubernetesData';
import { resetProbeHealth } from './probeUtils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  createQueryRunner: jest.fn(),
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockCreateQueryRunner = jest.mocked(createQueryRunner);
const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);

const run = jest.fn();
const destroy = jest.fn();
const healthGet = jest.fn();

// Mirrors the k8s app's persisted-choice key (grafana-k8s-app src/constants.ts K8S_STORAGE_KEY).
const K8S_APP_STORAGE_KEY = 'grafana.k8s-app.navigation.storage';

function createPrometheusListItem(ds: { uid: string; name: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid,
    name: ds.name,
    type: 'prometheus',
    meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
    isDefault: ds.isDefault ?? false,
  };
}

function setDataSources(list: Array<{ uid: string; name: string; isDefault?: boolean }>) {
  mockGetDataSourceInstanceList.mockResolvedValue(list.map(createPrometheusListItem));
}

async function resolveRequiredDatasource(): Promise<DataSourceInstanceListItem> {
  const datasource = await resolveKubernetesDatasource();
  expect(datasource).not.toBeNull();
  return datasource!;
}

// uid -> namespace/cluster count the datasource reports; absent uid = no Kubernetes data there.
let dataByUid: Record<string, number>;
// Probe queries against these uids emit LoadingState.Error (unreachable/erroring datasource).
let probeErrorUids: Set<string>;
let probeHangUids: Set<string>;
// Probe queries against these uids emit LoadingState.Error for the first N attempts.
let probeFailuresByUid: Record<string, number>;
let probeAttempts: Record<string, number>;
// Non-probe batches containing these refIds emit LoadingState.Error; sibling refIds' frames survive.
let queryErrorRefIds: Set<string>;
let lastErrorData: PanelData | undefined;
let valuesByRefId: Record<string, number>;

type CapturedRun = { datasource: { uid: string }; queries: Array<{ refId: string; expr: string }> };

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values }] });
}

beforeEach(() => {
  run.mockReset();
  destroy.mockReset();
  mockCreateQueryRunner.mockReset();
  mockGetDataSourceInstanceList.mockReset();
  healthGet.mockReset();
  // Health gate: every candidate healthy unless a test overrides by uid.
  healthGet.mockResolvedValue({ status: 'OK' });
  jest.mocked(getBackendSrv).mockReturnValue({ get: healthGet } as unknown as BackendSrv);
  window.localStorage.clear();
  resetKubernetesPrometheusResolution();
  // The /health cache is module-level and shared across scans; a cached OK would leak between tests.
  resetProbeHealth();
  dataByUid = {};
  probeErrorUids = new Set();
  probeHangUids = new Set();
  probeFailuresByUid = {};
  probeAttempts = {};
  queryErrorRefIds = new Set();
  lastErrorData = undefined;
  valuesByRefId = {};
  mockCreateQueryRunner.mockImplementation(() => {
    // Per-runner capture: parallel probes each get their own runner, so a shared variable would race.
    let captured: CapturedRun | undefined;
    const runner = {
      run: (opts: CapturedRun) => {
        captured = opts;
        run(opts);
      },
      get: () => {
        const uid = captured?.datasource.uid ?? '';
        const isProbe = captured?.queries.some((q) => q.refId === 'probe') ?? false;
        if (isProbe) {
          probeAttempts[uid] = (probeAttempts[uid] ?? 0) + 1;
          if (probeHangUids.has(uid)) {
            return NEVER;
          }
          if (probeErrorUids.has(uid) || probeAttempts[uid] <= (probeFailuresByUid[uid] ?? 0)) {
            return of({ state: LoadingState.Error, series: [] as DataFrame[], timeRange: {} } as PanelData);
          }
        }
        const count = dataByUid[uid] ?? 0;
        if (!isProbe && captured?.queries.some((q) => queryErrorRefIds.has(q.refId))) {
          // Runner partial-error shape: erroring targets drop out, sibling frames survive.
          const survivors = captured.queries
            .filter((q) => !queryErrorRefIds.has(q.refId))
            .map((q) =>
              numberFrame(q.refId, [
                valuesByRefId[q.refId] ?? (q.refId === 'clusters' || q.refId === 'pods' ? count : 0),
              ])
            );
          lastErrorData = { state: LoadingState.Error, series: survivors, timeRange: {} } as PanelData;
          return of(lastErrorData);
        }
        let series: DataFrame[] = [];
        if (isProbe && count > 0) {
          series = [numberFrame('probe', [count])];
        } else if (!isProbe && count > 0 && captured) {
          // Inventory/health batches: answer each refId so positive tests assert counts.
          series = captured.queries.map((q) => {
            const value = valuesByRefId[q.refId] ?? (q.refId === 'clusters' || q.refId === 'pods' ? count : 0);
            return numberFrame(q.refId, [value]);
          });
        }
        return of({ state: LoadingState.Done, series, timeRange: {} } as PanelData);
      },
      cancel: jest.fn(),
      destroy,
    };
    return runner as unknown as QueryRunner;
  });
});

afterEach(() => jest.restoreAllMocks());

type RunCall = [CapturedRun];
const probeCalls = () => (run.mock.calls as RunCall[]).filter(([o]) => o.queries[0].refId === 'probe');
const inventoryCalls = () =>
  (run.mock.calls as RunCall[]).filter(([o]) => o.queries.some((q) => q.refId === 'clusters'));
const healthCalls = () =>
  (run.mock.calls as RunCall[]).filter(([o]) => o.queries.some((q) => q.refId === 'alertsFiring'));
const cpuCalls = () => (run.mock.calls as RunCall[]).filter(([o]) => o.queries[0].refId === 'cpu');

describe('Kubernetes Prometheus resolution', () => {
  it('picks the stored k8s-app choice over an isDefault sibling when both have data', async () => {
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, JSON.stringify({ promName: 'k8s-prom' }));
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'k8s-uid', name: 'k8s-prom' },
    ]);
    dataByUid = { 'default-uid': 3, 'k8s-uid': 2 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('k8s-uid');
    expect(inventory.clusters).toBeGreaterThan(0);
  });

  it('runs inventory and health query batches with the expected PromQL', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };

    const datasource = await resolveRequiredDatasource();
    await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    const [inventory] = inventoryCalls();
    const inventoryExprs = Object.fromEntries(inventory[0].queries.map((q) => [q.refId, q.expr]));
    expect(inventoryExprs).toEqual({
      clusters: 'count(group by (cluster) (kube_node_info{cluster!=""}))',
      // Running|Pending only, deduplicated per pod: the population the Kubernetes Monitoring app counts.
      pods: 'count(max by (cluster, namespace, pod) (kube_pod_status_phase{cluster!="",phase=~"Running|Pending"}) == 1)',
    });

    const [health] = healthCalls();
    const healthExprs = Object.fromEntries(health[0].queries.map((q) => [q.refId, q.expr]));
    expect(healthExprs).toEqual({
      // Pending now and 10m ago, so a pod mid-scheduling never counts.
      pendingPods:
        'count(max by (cluster, namespace, pod) (kube_pod_status_phase{phase="Pending"}) == 1 and max by (cluster, namespace, pod) (kube_pod_status_phase{phase="Pending"} offset 10m) == 1)',
      crashLoopingPods:
        'count(max by (cluster, namespace, pod) (kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}) == 1)',
      notReadyNodes:
        'count(max by (cluster, node) (kube_node_status_condition{condition="Ready",status=~"false|unknown"}) == 1)',
      // The app's alert-name allowlist, so the count matches its alerts page.
      alertsFiring:
        'count(ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!=""} or GRAFANA_ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!=""})',
    });

    const [probe] = probeCalls();
    expect(probe[0].queries[0].expr).toBe('count(last_over_time(kube_node_info{cluster!=""}[24h]))');
  });

  it('skips a default datasource without node data for a sibling that has it', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'team-uid': 1 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventory.clusters).toBe(1);
    expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    const probedUids = probeCalls().map(([o]) => o.datasource.uid);
    expect(probedUids).toEqual(expect.arrayContaining(['default-uid', 'team-uid']));
  });

  it('skips an unhealthy datasource before probing', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'default-uid': 5, 'team-uid': 1 };
    healthGet.mockImplementation(async (url: string) =>
      url.includes('default-uid') ? { status: 'ERROR' } : { status: 'OK' }
    );

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    expect(inventory.clusters).toBe(1);
    // The unhealthy datasource is dropped before the node probe ever runs.
    expect(probeCalls().map(([o]) => o.datasource.uid)).toEqual(['team-uid']);
  });

  it('falls through to the first sibling in list order when several have data', async () => {
    setDataSources([
      { uid: 'alpha-uid', name: 'alpha-prom' },
      { uid: 'beta-uid', name: 'beta-prom' },
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
    ]);
    dataByUid = { 'alpha-uid': 2, 'beta-uid': 7 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('alpha-uid');
    expect(inventory.clusters).toBe(2);
  });

  it('falls through from a stored choice without data to the default that has it', async () => {
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, JSON.stringify({ promName: 'k8s-prom' }));
    setDataSources([
      { uid: 'k8s-uid', name: 'k8s-prom' },
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
    ]);
    dataByUid = { 'default-uid': 4 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('default-uid');
    expect(inventory.clusters).toBe(4);
  });

  it('resolves null when no datasource has Kubernetes data, and never runs inventory or health queries', async () => {
    setDataSources([
      { uid: 'a-uid', name: 'a-prom' },
      { uid: 'b-uid', name: 'b-prom' },
    ]);

    await expect(resolveKubernetesDatasource()).resolves.toBeNull();
    expect(inventoryCalls()).toHaveLength(0);
    expect(healthCalls()).toHaveLength(0);
  });

  it('does not probe utility datasources when a non-utility one exists', async () => {
    setDataSources([
      { uid: 'usage-uid', name: 'grafanacloud-usage' },
      { uid: 'ml-uid', name: 'grafanacloud-ml-metrics' },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'usage-uid': 9, 'ml-uid': 9, 'team-uid': 2 };

    const datasource = await resolveRequiredDatasource();
    await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    const probedUids = probeCalls().map(([o]) => o.datasource.uid);
    expect(probedUids).not.toContain('usage-uid');
    expect(probedUids).not.toContain('ml-uid');
  });

  it('never probes a lone utility-named datasource', async () => {
    setDataSources([{ uid: 'usage-uid', name: 'grafanacloud-usage' }]);
    dataByUid = { 'usage-uid': 1 };

    await expect(resolveKubernetesDatasource()).resolves.toBeNull();
    expect(probeCalls()).toHaveLength(0);
  });

  it('keeps a user datasource whose name merely contains "usage" (exact-match skip)', async () => {
    setDataSources([
      { uid: 'a', name: 'cpu-usage-prom', isDefault: true },
      { uid: 'b', name: 'team-prom' },
    ]);
    dataByUid = { a: 1, b: 1 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    // Substring matching would demote 'cpu-usage-prom'; exact-match leaves this default in place.
    expect(inventoryCalls()[0][0].datasource.uid).toBe('a');
    expect(inventory.clusters).toBe(1);
  });

  it('falls back to the heuristic without throwing when the stored value is corrupt JSON', async () => {
    // store.getObject logs (does not throw) on a bad parse; silence it so failOnConsole stays green.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, '{not json');
    setDataSources([
      { uid: 'first-uid', name: 'first-prom' },
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
    ]);
    dataByUid = { 'default-uid': 2 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('default-uid');
    expect(inventory.clusters).toBe(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects and queries nothing when there are no datasources', async () => {
    setDataSources([]);

    await expect(resolveKubernetesDatasource()).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('excludes the -- Grafana -- builtin from candidates but keeps prometheus-alias datasources', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);
    dataByUid = { 'only-uid': 1 };

    const datasource = await resolveRequiredDatasource();
    await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    const filters = mockGetDataSourceInstanceList.mock.calls[0][0];
    expect(filters?.type).toBe('prometheus');
    const filter = filters?.filter;
    expect(filter).toBeDefined();
    const item = (partial: { name: string; type: string; metaId: string }): DataSourceInstanceListItem => ({
      uid: partial.name,
      name: partial.name,
      type: partial.type,
      meta: { id: partial.metaId } as DataSourceInstanceListItem['meta'],
      isDefault: false,
    });
    // Builtin rejected by meta.id; real and alias prometheus datasources pass.
    expect(filter!(item({ name: '-- Grafana --', type: 'datasource', metaId: 'grafana' }))).toBe(false);
    expect(filter!(item({ name: 'team-prom', type: 'prometheus', metaId: 'prometheus' }))).toBe(true);
    expect(
      filter!(
        item({
          name: 'amp',
          type: 'grafana-amazonprometheus-datasource',
          metaId: 'grafana-amazonprometheus-datasource',
        })
      )
    ).toBe(true);
  });

  it('shares one resolution across concurrent callers and passes the result to each fetcher', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);
    dataByUid = { 'only-uid': 1 };

    const resolved = await Promise.all([
      resolveKubernetesDatasource(),
      resolveKubernetesDatasource(),
      resolveKubernetesDatasource(),
    ]);
    const datasource = resolved[0]!;
    await Promise.all([
      fetchKubernetesInventory(datasource, {}),
      fetchKubernetesHealth(datasource, {}),
      fetchClusterCpuSeries(datasource, {}),
    ]);

    expect(probeCalls()).toHaveLength(1);
    expect(resolved).toEqual([datasource, datasource, datasource]);
    expect(inventoryCalls()).toHaveLength(1);
    expect(healthCalls()).toHaveLength(1);
    expect(cpuCalls()[0][0].datasource.uid).toBe('only-uid');
  });

  it('re-resolves after the cache TTL so datasource changes are picked up', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(0);
      setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);
      dataByUid = { 'only-uid': 1 };

      const first = await resolveRequiredDatasource();
      await fetchKubernetesInventory(first, {});
      await fetchKubernetesHealth(first, {});
      expect(probeCalls()).toHaveLength(1);

      nowSpy.mockReturnValue(61_000); // past RESOLUTION_TTL_MS
      const second = await resolveRequiredDatasource();
      await fetchKubernetesInventory(second, {});
      await fetchKubernetesHealth(second, {});

      expect(probeCalls()).toHaveLength(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('probes only the first ten candidates, truncating lower-priority ones', async () => {
    setDataSources(Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}` })));
    dataByUid = { 'p11-uid': 1 };

    await expect(resolveKubernetesDatasource()).resolves.toBeNull();
    expect(probeCalls()).toHaveLength(10);
  });

  it('still probes a stored choice that sits beyond the probe cap', async () => {
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, JSON.stringify({ promName: 'p11' }));
    setDataSources(Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}` })));
    dataByUid = { 'p11-uid': 1 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('p11-uid');
    expect(inventory.clusters).toBe(1);
  });

  it('still probes a default datasource that sits beyond the probe cap', async () => {
    setDataSources(
      Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}`, isDefault: i === 10 }))
    );
    dataByUid = { 'p11-uid': 1 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('p11-uid');
    expect(inventory.clusters).toBe(1);
  });

  it('treats a probe error on a high-priority datasource as no data and falls through', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'default-uid': 5, 'team-uid': 1 };
    probeErrorUids = new Set(['default-uid']);

    jest.useFakeTimers();
    try {
      const datasourcePromise = resolveRequiredDatasource();
      await jest.advanceTimersByTimeAsync(10_000);
      const datasource = await datasourcePromise;
      const inventory = await fetchKubernetesInventory(datasource, {});
      await fetchKubernetesHealth(datasource, {});

      expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
      expect(inventory.clusters).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('an errored probe reads as no data and a sibling wins', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'default-uid': 5, 'team-uid': 1 };
    probeFailuresByUid = { 'default-uid': 1 };

    const datasource = await resolveRequiredDatasource();
    const inventory = await fetchKubernetesInventory(datasource, {});
    await fetchKubernetesHealth(datasource, {});

    expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    expect(inventory.clusters).toBe(1);
    // Exactly one attempt per candidate: the probe never retries.
    expect(probeAttempts).toEqual({ 'default-uid': 1, 'team-uid': 1 });
  });

  it('resolves null when every probe errors', async () => {
    setDataSources([
      { uid: 'a-uid', name: 'a-prom' },
      { uid: 'b-uid', name: 'b-prom' },
    ]);
    dataByUid = { 'a-uid': 3, 'b-uid': 3 };
    probeErrorUids = new Set(['a-uid', 'b-uid']);

    await expect(resolveKubernetesDatasource()).resolves.toBeNull();
    expect(inventoryCalls()).toHaveLength(0);
  });

  it('does not cache a failed resolution for the TTL window', async () => {
    mockGetDataSourceInstanceList.mockRejectedValue(new Error('list down'));

    jest.useFakeTimers();
    try {
      const failing = resolveKubernetesDatasource();
      failing.catch(() => {}); // keep the rejection handled while timers advance
      await jest.advanceTimersByTimeAsync(10_000);
      await expect(failing).rejects.toThrow('list down');

      setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]); // replaces the rejecting mock impl
      dataByUid = { 'k8s-uid': 2 };
      const promise = resolveRequiredDatasource();
      await jest.advanceTimersByTimeAsync(10_000);
      expect((await promise).uid).toBe('k8s-uid');
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects when one inventory query errors even though the sibling frame survives', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    queryErrorRefIds = new Set(['clusters']);

    const datasource = await resolveRequiredDatasource();
    await expect(fetchKubernetesInventory(datasource, {})).rejects.toThrow('Prometheus query failed');
    // Pin the scenario: the pods frame really survived and was discarded — not an empty error.
    expect(lastErrorData?.series.map((f) => f.refId)).toEqual(['pods']);
    expect(inventoryCalls()).toHaveLength(1);
  });

  it('uses the configured state-history metric name in the alerts union', async () => {
    const original = config.unifiedAlerting.stateHistory;
    config.unifiedAlerting.stateHistory = { prometheusMetricName: 'MY_ALERTS' };
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    try {
      const datasource = await resolveRequiredDatasource();
      await fetchKubernetesHealth(datasource, {});
      const [health] = healthCalls();
      const alertsExpr = health[0].queries.find((q) => q.refId === 'alertsFiring')?.expr;
      expect(alertsExpr).toBe(
        'count(ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!=""} or MY_ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!=""})'
      );
    } finally {
      config.unifiedAlerting.stateHistory = original;
    }
  });

  it('queries Grafana-managed alerts on the state-history datasource and sums the counts', async () => {
    const original = config.unifiedAlerting.stateHistory;
    config.unifiedAlerting.stateHistory = { prometheusTargetDatasourceUID: 'ash-uid' };
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2, 'ash-uid': 1 };
    valuesByRefId = { alertsFiring: 1, grafanaAlertsFiring: 2 };
    try {
      const datasource = await resolveRequiredDatasource();
      const health = await fetchKubernetesHealth(datasource, {});
      const ashCalls = (run.mock.calls as RunCall[]).filter(([o]) => o.datasource.uid === 'ash-uid');
      expect(ashCalls).toHaveLength(1);
      expect(ashCalls[0][0].queries).toEqual([
        {
          refId: 'grafanaAlertsFiring',
          expr: 'count(GRAFANA_ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!=""})',
          instant: true,
          range: false,
        },
      ]);
      const [k8sHealth] = healthCalls();
      const alertsExpr = k8sHealth[0].queries.find((q) => q.refId === 'alertsFiring')?.expr;
      expect(alertsExpr).toBe(
        'count(ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!=""})'
      );
      expect(alertsExpr).not.toContain('GRAFANA_ALERTS');
      expect(health.alertsFiring).toBe(3);
    } finally {
      config.unifiedAlerting.stateHistory = original;
    }
  });

  it('falls back to datasource-managed alerts when the state-history query errors', async () => {
    const original = config.unifiedAlerting.stateHistory;
    config.unifiedAlerting.stateHistory = { prometheusTargetDatasourceUID: 'ash-uid' };
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2, 'ash-uid': 1 };
    valuesByRefId = { alertsFiring: 1 };
    queryErrorRefIds = new Set(['grafanaAlertsFiring']);
    jest.useFakeTimers();
    try {
      const datasource = await resolveRequiredDatasource();
      const promise = fetchKubernetesHealth(datasource, {});
      await jest.advanceTimersByTimeAsync(10_000);
      const health = await promise;
      expect(health.alertsFiring).toBe(1);
    } finally {
      jest.useRealTimers();
      config.unifiedAlerting.stateHistory = original;
    }
  });

  it('falls through to a sibling when the leader probe hangs', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'team-uid': 1 };
    probeHangUids = new Set(['default-uid']);

    jest.useFakeTimers();
    try {
      const datasourcePromise = resolveRequiredDatasource();
      await jest.advanceTimersByTimeAsync(60_000);
      const datasource = await datasourcePromise;
      const inventory = await fetchKubernetesInventory(datasource, {});
      expect(inventory.clusters).toBe(1);
      expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not run the CPU query when no datasource has Kubernetes data', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);

    await expect(resolveKubernetesDatasource()).resolves.toBeNull();
    expect(cpuCalls()).toHaveLength(0);
  });
});

describe('Kubernetes query filters', () => {
  const ds = { uid: 'k8s-uid', type: 'prometheus' };
  const filters = { cluster: 'prod', namespaces: ['team-a', 'team-b'] };

  it('scopes each signal per the cluster/namespace contract', async () => {
    await fetchKubernetesInventory(ds, filters);
    await fetchKubernetesHealth(ds, filters);
    await fetchClusterCpuSeries(ds, filters);

    const [inventory] = inventoryCalls();
    const inventoryExprs = Object.fromEntries(inventory[0].queries.map((q) => [q.refId, q.expr]));
    expect(inventoryExprs).toEqual({
      // Clusters are not namespaced: cluster matcher only.
      clusters: 'count(group by (cluster) (kube_node_info{cluster!="",cluster="prod"}))',
      pods: 'count(max by (cluster, namespace, pod) (kube_pod_status_phase{cluster!="",phase=~"Running|Pending",cluster="prod",namespace=~"team-a|team-b"}) == 1)',
    });

    const [health] = healthCalls();
    const healthExprs = Object.fromEntries(health[0].queries.map((q) => [q.refId, q.expr]));
    expect(healthExprs).toEqual({
      pendingPods:
        'count(max by (cluster, namespace, pod) (kube_pod_status_phase{phase="Pending",cluster="prod",namespace=~"team-a|team-b"}) == 1 and max by (cluster, namespace, pod) (kube_pod_status_phase{phase="Pending",cluster="prod",namespace=~"team-a|team-b"} offset 10m) == 1)',
      crashLoopingPods:
        'count(max by (cluster, namespace, pod) (kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff",cluster="prod",namespace=~"team-a|team-b"}) == 1)',
      // Namespace-blind node readiness is scoped to nodes hosting the selected namespaces' pods.
      notReadyNodes:
        'count(max by (cluster, node) (kube_node_status_condition{condition="Ready",status=~"false|unknown",cluster="prod"}) == 1 and on (cluster, node) group by (cluster, node) (kube_pod_info{cluster="prod",namespace=~"team-a|team-b"}))',
      // Strict matching: alerts without a selected namespace label are dropped.
      alertsFiring:
        'count(ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!="",cluster="prod",namespace=~"team-a|team-b"} or GRAFANA_ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!="",cluster="prod",namespace=~"team-a|team-b"})',
    });

    expect(cpuCalls()[0][0].queries[0].expr).toBe(
      'sum(rate(container_cpu_usage_seconds_total{container!="",cluster="prod",namespace=~"team-a|team-b"}[5m]))'
    );
  });

  it('carries the same filter matcher to the state-history alerts datasource', async () => {
    const original = config.unifiedAlerting.stateHistory;
    config.unifiedAlerting.stateHistory = { prometheusTargetDatasourceUID: 'ash-uid' };
    try {
      await fetchKubernetesHealth(ds, filters);

      const ashCalls = (run.mock.calls as RunCall[]).filter(([o]) => o.datasource.uid === 'ash-uid');
      expect(ashCalls).toHaveLength(1);
      expect(ashCalls[0][0].queries[0].expr).toBe(
        'count(GRAFANA_ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!="",cluster="prod",namespace=~"team-a|team-b"})'
      );
    } finally {
      config.unifiedAlerting.stateHistory = original;
    }
  });

  it('escapes string-literal and regex characters in filter values', async () => {
    await fetchKubernetesInventory(ds, { cluster: 'pro"d\\', namespaces: ['a.b|c'] });

    const [inventory] = inventoryCalls();
    const podsExpr = inventory[0].queries.find((q) => q.refId === 'pods')?.expr;
    // Exact-match cluster: string-literal escaping only.
    expect(podsExpr).toContain(String.raw`cluster="pro\"d\\"`);
    // Namespaces are regex alternatives: regex-escaped, then literal-escaped.
    expect(podsExpr).toContain(String.raw`namespace=~"a\\.b\\|c"`);
  });

  it('scopes pod signals to nodes via kube_pod_info and matches node-labeled signals directly', async () => {
    const nodeFilters = { cluster: 'prod', namespaces: ['team-a'], nodes: ['node-1', 'node-2'] };
    await fetchKubernetesInventory(ds, nodeFilters);
    await fetchKubernetesHealth(ds, nodeFilters);
    await fetchClusterCpuSeries(ds, nodeFilters);

    const nodeScope =
      ' and on (cluster, namespace, pod) group by (cluster, namespace, pod) (kube_pod_info{cluster="prod",node=~"node-1|node-2"})';
    const [inventory] = inventoryCalls();
    const inventoryExprs = Object.fromEntries(inventory[0].queries.map((q) => [q.refId, q.expr]));
    expect(inventoryExprs).toEqual({
      clusters: 'count(group by (cluster) (kube_node_info{cluster!="",cluster="prod",node=~"node-1|node-2"}))',
      // Pod state metrics carry no node label: scoped via the kube_pod_info join.
      pods: `count(max by (cluster, namespace, pod) (kube_pod_status_phase{cluster!="",phase=~"Running|Pending",cluster="prod",namespace=~"team-a"}) == 1${nodeScope})`,
    });

    const [health] = healthCalls();
    const healthExprs = Object.fromEntries(health[0].queries.map((q) => [q.refId, q.expr]));
    expect(healthExprs).toEqual({
      pendingPods: `count(max by (cluster, namespace, pod) (kube_pod_status_phase{phase="Pending",cluster="prod",namespace=~"team-a"}) == 1 and max by (cluster, namespace, pod) (kube_pod_status_phase{phase="Pending",cluster="prod",namespace=~"team-a"} offset 10m) == 1${nodeScope})`,
      crashLoopingPods: `count(max by (cluster, namespace, pod) (kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff",cluster="prod",namespace=~"team-a"}) == 1${nodeScope})`,
      // Node readiness intersects the node filter with nodes hosting the selected namespaces.
      notReadyNodes:
        'count(max by (cluster, node) (kube_node_status_condition{condition="Ready",status=~"false|unknown",cluster="prod",node=~"node-1|node-2"}) == 1 and on (cluster, node) group by (cluster, node) (kube_pod_info{cluster="prod",namespace=~"team-a",node=~"node-1|node-2"}))',
      // Strict matching: alerts must carry a selected namespace and node label.
      alertsFiring:
        'count(ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!="",cluster="prod",namespace=~"team-a",node=~"node-1|node-2"} or GRAFANA_ALERTS{alertstate="firing", alertname=~"(Kube.*|CPUThrottlingHigh)", cluster!="",cluster="prod",namespace=~"team-a",node=~"node-1|node-2"})',
    });

    expect(cpuCalls()[0][0].queries[0].expr).toBe(
      'sum(rate(container_cpu_usage_seconds_total{container!="",cluster="prod",namespace=~"team-a",node=~"node-1|node-2"}[5m]))'
    );
  });
});

describe('fetchKubernetesFilterOptions', () => {
  const ds = { uid: 'k8s-uid', type: 'prometheus' };
  let failedRefIds: Set<string>;

  function labeledField(label: string, value: string) {
    return { name: 'Value', type: FieldType.number, values: [1], labels: { [label]: value } };
  }

  beforeEach(() => {
    failedRefIds = new Set();
    // Discovery frames carry label values, which the shared harness never emits: dedicated runner.
    mockCreateQueryRunner.mockImplementation(() => {
      let captured: CapturedRun | undefined;
      const runner = {
        run: (opts: CapturedRun) => {
          captured = opts;
          run(opts);
        },
        get: () => {
          const refId = captured?.queries[0].refId ?? '';
          if (failedRefIds.has(refId)) {
            return of({ state: LoadingState.Error, series: [] as DataFrame[], timeRange: {} } as PanelData);
          }
          const series =
            refId === 'clusters'
              ? // Multi-frame shape: one frame per series.
                [
                  createDataFrame({ refId, fields: [labeledField('cluster', 'staging')] }),
                  createDataFrame({ refId, fields: [labeledField('cluster', 'prod')] }),
                ]
              : refId === 'nodes'
                ? [createDataFrame({ refId, fields: [labeledField('node', 'node-2'), labeledField('node', 'node-1')] })]
                : // Multi-field shape: one frame, one number field per series.
                  [
                    createDataFrame({
                      refId,
                      fields: [labeledField('namespace', 'team-a'), labeledField('namespace', 'default')],
                    }),
                  ];
          return of({ state: LoadingState.Done, series, timeRange: {} } as PanelData);
        },
        cancel: jest.fn(),
        destroy,
      };
      return runner as unknown as QueryRunner;
    });
  });

  it('collects sorted label values from both discovery shapes with instant exprs', async () => {
    await expect(fetchKubernetesFilterOptions(ds)).resolves.toEqual({
      clusters: ['prod', 'staging'],
      namespaces: ['default', 'team-a'],
      nodes: ['node-1', 'node-2'],
    });

    const exprs = (run.mock.calls as RunCall[]).map(([o]) => o.queries[0].expr).sort();
    expect(exprs).toEqual([
      'group by (cluster) (kube_node_info{cluster!=""})',
      'group by (namespace) (kube_namespace_status_phase{cluster!=""})',
      'group by (node) (kube_node_info{cluster!=""})',
    ]);
  });

  it('nulls only the failed picker so the others keep their options', async () => {
    failedRefIds = new Set(['clusters']);
    await expect(fetchKubernetesFilterOptions(ds)).resolves.toEqual({
      clusters: null,
      namespaces: ['default', 'team-a'],
      nodes: ['node-1', 'node-2'],
    });

    failedRefIds = new Set(['namespaces']);
    await expect(fetchKubernetesFilterOptions(ds)).resolves.toEqual({
      clusters: ['prod', 'staging'],
      namespaces: null,
      nodes: ['node-1', 'node-2'],
    });

    failedRefIds = new Set(['nodes']);
    await expect(fetchKubernetesFilterOptions(ds)).resolves.toEqual({
      clusters: ['prod', 'staging'],
      namespaces: ['default', 'team-a'],
      nodes: null,
    });

    failedRefIds = new Set(['clusters', 'namespaces', 'nodes']);
    await expect(fetchKubernetesFilterOptions(ds)).resolves.toEqual({ clusters: null, namespaces: null, nodes: null });
  });
});
