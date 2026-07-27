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
import { config, createQueryRunner } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  fetchClusterCpuSeries,
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  resolveKubernetesDatasource,
  resetKubernetesPrometheusResolution,
} from './kubernetesData';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  createQueryRunner: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockCreateQueryRunner = jest.mocked(createQueryRunner);
const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);

const run = jest.fn();
const destroy = jest.fn();

// Mirrors the k8s app's persisted-choice key (grafana-k8s-app src/constants.ts K8S_STORAGE_KEY).
const K8S_APP_STORAGE_KEY = 'grafana.k8s-app.navigation.storage';

function createPrometheusListItem(ds: { uid: string; name: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid,
    name: ds.name,
    type: 'prometheus',
    meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: ds.isDefault ?? false,
  };
}

function setDataSources(list: Array<{ uid: string; name: string; isDefault?: boolean }>) {
  mockGetDataSourceInstanceList.mockResolvedValue(list.map(createPrometheusListItem));
}

// uid -> namespace/cluster count the datasource reports; absent uid = no Kubernetes data there.
let dataByUid: Record<string, number>;
// Probe queries against these uids emit LoadingState.Error (unreachable/erroring datasource).
let probeErrorUids: Set<string>;
let probeHangUids: Set<string>;
// Probe queries against these uids emit LoadingState.Error for the first N attempts.
let probeFailuresByUid: Record<string, number>;
let probeAttempts: Record<string, number>;
// Non-probe query batches: emit LoadingState.Error for the first N attempts per refId (keyed by first refId).
let queryFailuresByRefId: Record<string, number>;
// Non-probe query batches: always emit LoadingState.Error.
let queryErrorRefIds: Set<string>;
let valuesByRefId: Record<string, number>;
let queryAttempts: Record<string, number>;

type CapturedRun = { datasource: { uid: string }; queries: Array<{ refId: string; expr: string }> };

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values }] });
}

beforeEach(() => {
  run.mockReset();
  destroy.mockReset();
  mockCreateQueryRunner.mockReset();
  mockGetDataSourceInstanceList.mockReset();
  window.localStorage.clear();
  resetKubernetesPrometheusResolution();
  dataByUid = {};
  probeErrorUids = new Set();
  probeHangUids = new Set();
  probeFailuresByUid = {};
  probeAttempts = {};
  queryFailuresByRefId = {};
  queryErrorRefIds = new Set();
  valuesByRefId = {};
  queryAttempts = {};
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
        const isProbe = captured?.queries.some((q) => q.refId === 'namespaces') ?? false;
        if (isProbe) {
          probeAttempts[uid] = (probeAttempts[uid] ?? 0) + 1;
          if (probeHangUids.has(uid)) {
            return NEVER;
          }
          if (probeErrorUids.has(uid) || probeAttempts[uid] <= (probeFailuresByUid[uid] ?? 0)) {
            return of({ state: LoadingState.Error, series: [] as DataFrame[], timeRange: {} } as PanelData);
          }
        }
        if (!isProbe && captured) {
          const batchKey = captured.queries[0]?.refId ?? '';
          queryAttempts[batchKey] = (queryAttempts[batchKey] ?? 0) + 1;
          const maxTransientFailures = Math.max(0, ...captured.queries.map((q) => queryFailuresByRefId[q.refId] ?? 0));
          const errorTransient = maxTransientFailures > 0 && queryAttempts[batchKey] <= maxTransientFailures;
          const errorAlways = captured.queries.some((q) => queryErrorRefIds.has(q.refId));
          if (errorAlways || errorTransient) {
            return of({ state: LoadingState.Error, series: [] as DataFrame[], timeRange: {} } as PanelData);
          }
        }
        const count = dataByUid[uid] ?? 0;
        let series: DataFrame[] = [];
        if (isProbe && count > 0) {
          series = [numberFrame('namespaces', [count])];
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
const probeCalls = () => (run.mock.calls as RunCall[]).filter(([o]) => o.queries[0].refId === 'namespaces');
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

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    expect(inventoryCalls()[0][0].datasource.uid).toBe('k8s-uid');
    expect(inventory.clusters).toBeGreaterThan(0);
  });

  it('runs inventory and health query batches with the expected PromQL', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };

    await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    const [inventory] = inventoryCalls();
    const inventoryExprs = Object.fromEntries(inventory[0].queries.map((q) => [q.refId, q.expr]));
    expect(inventoryExprs).toEqual({
      clusters: 'count(group by (cluster) (last_over_time(kube_node_info[24h])))',
      pods: 'count(group by (cluster, namespace, pod) (last_over_time(kube_pod_info[24h])))',
    });

    const [health] = healthCalls();
    const healthExprs = Object.fromEntries(health[0].queries.map((q) => [q.refId, q.expr]));
    expect(healthExprs).toEqual({
      unhealthyPods: 'sum(kube_pod_status_phase{phase=~"Pending|Failed|Unknown"})',
      restarts1h: 'sum(increase(kube_pod_container_status_restarts_total[1h]))',
      notReadyNodes: 'sum(kube_node_status_condition{condition="Ready",status=~"false|unknown"})',
      alertsFiring:
        'count(ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""} or GRAFANA_ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""})',
    });

    const [probe] = probeCalls();
    expect(probe[0].queries[0].expr).toBe('count(last_over_time(kube_namespace_status_phase[24h]))');
  });

  it('rounds fractional restart increase() noise so phantom restarts never surface', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    valuesByRefId = { restarts1h: 0.0003 };

    expect((await fetchKubernetesHealth()).restarts1h).toBe(0);

    valuesByRefId = { restarts1h: 0.98 };
    expect((await fetchKubernetesHealth()).restarts1h).toBe(1);
  });

  it('skips a default datasource without namespace data for a sibling that has it', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'team-uid': 1 };

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    expect(inventory.clusters).toBe(1);
    expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    const probedUids = probeCalls().map(([o]) => o.datasource.uid);
    expect(probedUids).toEqual(expect.arrayContaining(['default-uid', 'team-uid']));
  });

  it('falls through to the first sibling in list order when several have data', async () => {
    setDataSources([
      { uid: 'alpha-uid', name: 'alpha-prom' },
      { uid: 'beta-uid', name: 'beta-prom' },
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
    ]);
    dataByUid = { 'alpha-uid': 2, 'beta-uid': 7 };

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

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

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    expect(inventoryCalls()[0][0].datasource.uid).toBe('default-uid');
    expect(inventory.clusters).toBe(4);
  });

  it('rejects when no datasource has Kubernetes data, and never runs inventory or health queries', async () => {
    setDataSources([
      { uid: 'a-uid', name: 'a-prom' },
      { uid: 'b-uid', name: 'b-prom' },
    ]);

    await expect(fetchKubernetesInventory()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
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

    await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    const probedUids = probeCalls().map(([o]) => o.datasource.uid);
    expect(probedUids).not.toContain('usage-uid');
    expect(probedUids).not.toContain('ml-uid');
  });

  it('still probes and picks a lone utility-named datasource', async () => {
    setDataSources([{ uid: 'usage-uid', name: 'grafanacloud-usage' }]);
    dataByUid = { 'usage-uid': 1 };

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    expect(inventoryCalls()[0][0].datasource.uid).toBe('usage-uid');
    expect(inventory.clusters).toBe(1);
  });

  it('keeps a user datasource whose name merely contains "usage" (exact-match skip)', async () => {
    setDataSources([
      { uid: 'a', name: 'cpu-usage-prom', isDefault: true },
      { uid: 'b', name: 'team-prom' },
    ]);
    dataByUid = { a: 1, b: 1 };

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

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

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    expect(inventoryCalls()[0][0].datasource.uid).toBe('default-uid');
    expect(inventory.clusters).toBe(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects and queries nothing when there are no datasources', async () => {
    setDataSources([]);

    await expect(fetchKubernetesInventory()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(run).not.toHaveBeenCalled();
  });

  it('excludes the -- Grafana -- builtin from candidates but keeps prometheus-alias datasources', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);
    dataByUid = { 'only-uid': 1 };

    await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    const filters = mockGetDataSourceInstanceList.mock.calls[0][0];
    expect(filters?.type).toBe('prometheus');
    const filter = filters?.filter;
    expect(filter).toBeDefined();
    const item = (partial: { name: string; type: string; metaId: string }): DataSourceInstanceListItem => ({
      uid: partial.name,
      name: partial.name,
      type: partial.type,
      meta: { id: partial.metaId } as DataSourceInstanceListItem['meta'],
      readOnly: false,
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

  it('shares one resolution across concurrent fetchers; a missing cpu metric returns null', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);
    dataByUid = { 'only-uid': 1 };

    await Promise.all([
      resolveKubernetesDatasource(),
      fetchKubernetesInventory(),
      fetchKubernetesHealth(),
      fetchClusterCpuSeries(),
    ]);

    expect(probeCalls()).toHaveLength(1);
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

      await fetchKubernetesInventory();
      await fetchKubernetesHealth();
      expect(probeCalls()).toHaveLength(1);

      nowSpy.mockReturnValue(61_000); // past RESOLUTION_TTL_MS
      await fetchKubernetesInventory();
      await fetchKubernetesHealth();

      expect(probeCalls()).toHaveLength(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('probes only the first ten candidates, truncating lower-priority ones', async () => {
    setDataSources(Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}` })));
    dataByUid = { 'p11-uid': 1 };

    await expect(fetchKubernetesInventory()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(probeCalls()).toHaveLength(10);
  });

  it('still probes a stored choice that sits beyond the probe cap', async () => {
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, JSON.stringify({ promName: 'p11' }));
    setDataSources(Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}` })));
    dataByUid = { 'p11-uid': 1 };

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

    expect(inventoryCalls()[0][0].datasource.uid).toBe('p11-uid');
    expect(inventory.clusters).toBe(1);
  });

  it('still probes a default datasource that sits beyond the probe cap', async () => {
    setDataSources(
      Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}`, isDefault: i === 10 }))
    );
    dataByUid = { 'p11-uid': 1 };

    const inventory = await fetchKubernetesInventory();
    await fetchKubernetesHealth();

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
      const inventoryPromise = fetchKubernetesInventory();
      const healthPromise = fetchKubernetesHealth();
      await jest.advanceTimersByTimeAsync(10_000);
      const inventory = await inventoryPromise;
      await healthPromise;

      expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
      expect(inventory.clusters).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries an errored probe so a transient failure keeps the default', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'default-uid': 5, 'team-uid': 1 };
    probeFailuresByUid = { 'default-uid': 1 };

    jest.useFakeTimers();
    try {
      const inventoryPromise = fetchKubernetesInventory();
      const healthPromise = fetchKubernetesHealth();
      await jest.advanceTimersByTimeAsync(10_000);
      const inventory = await inventoryPromise;
      await healthPromise;

      expect(inventoryCalls()[0][0].datasource.uid).toBe('default-uid');
      expect(inventory.clusters).toBe(5);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects when every probe errors', async () => {
    setDataSources([
      { uid: 'a-uid', name: 'a-prom' },
      { uid: 'b-uid', name: 'b-prom' },
    ]);
    dataByUid = { 'a-uid': 3, 'b-uid': 3 };
    probeErrorUids = new Set(['a-uid', 'b-uid']);

    jest.useFakeTimers();
    try {
      const assertion = expect(fetchKubernetesInventory()).rejects.toThrow(
        'No Prometheus datasource with Kubernetes data'
      );
      await jest.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(inventoryCalls()).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('probes only the leader when the top-priority datasource has data', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'default-uid': 3, 'team-uid': 2 };

    await fetchKubernetesInventory();

    expect(probeCalls()).toHaveLength(1);
    expect(probeCalls()[0][0].datasource.uid).toBe('default-uid');
  });

  it('retries a transient inventory query error instead of blanking the region', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    queryFailuresByRefId = { clusters: 1 };

    jest.useFakeTimers();
    try {
      const promise = fetchKubernetesInventory();
      await jest.advanceTimersByTimeAsync(10_000);
      const inventory = await promise;

      expect(inventory.clusters).toBe(2);
      expect(inventoryCalls()).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries a transient cpu query error', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    queryFailuresByRefId = { cpu: 1 };

    jest.useFakeTimers();
    try {
      const promise = fetchClusterCpuSeries();
      await jest.advanceTimersByTimeAsync(10_000);
      await promise;

      expect(cpuCalls()).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries a transient datasource-list failure', async () => {
    mockGetDataSourceInstanceList
      .mockRejectedValueOnce(new Error('gateway blip'))
      .mockResolvedValue([createPrometheusListItem({ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true })]);
    dataByUid = { 'k8s-uid': 2 };

    jest.useFakeTimers();
    try {
      const promise = fetchKubernetesInventory();
      await jest.advanceTimersByTimeAsync(10_000);
      expect((await promise).clusters).toBe(2);
      expect(mockGetDataSourceInstanceList).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not cache a failed resolution for the TTL window', async () => {
    mockGetDataSourceInstanceList.mockRejectedValue(new Error('list down'));

    jest.useFakeTimers();
    try {
      const failing = fetchKubernetesInventory();
      failing.catch(() => {}); // keep the rejection handled while timers advance
      await jest.advanceTimersByTimeAsync(10_000);
      await expect(failing).rejects.toThrow('list down');

      setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]); // replaces the rejecting mock impl
      dataByUid = { 'k8s-uid': 2 };
      const promise = fetchKubernetesInventory();
      await jest.advanceTimersByTimeAsync(10_000);
      expect((await promise).clusters).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects after three failed inventory attempts', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    queryErrorRefIds = new Set(['clusters']);

    jest.useFakeTimers();
    try {
      const assertion = expect(fetchKubernetesInventory()).rejects.toThrow();
      await jest.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(inventoryCalls()).toHaveLength(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('recovers when only the third inventory attempt succeeds', async () => {
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    queryFailuresByRefId = { clusters: 2 };

    jest.useFakeTimers();
    try {
      const promise = fetchKubernetesInventory();
      await jest.advanceTimersByTimeAsync(10_000);
      const inventory = await promise;

      expect(inventory.clusters).toBe(2);
      expect(inventoryCalls()).toHaveLength(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the default when its probe fails twice then succeeds', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'default-uid': 5, 'team-uid': 1 };
    probeFailuresByUid = { 'default-uid': 2 };

    jest.useFakeTimers();
    try {
      const inventoryPromise = fetchKubernetesInventory();
      await jest.advanceTimersByTimeAsync(10_000);
      const inventory = await inventoryPromise;

      expect(inventoryCalls()[0][0].datasource.uid).toBe('default-uid');
      expect(inventory.clusters).toBe(5);
      expect(probeAttempts['default-uid']).toBe(3);
      expect(probeCalls().map(([o]) => o.datasource.uid)).not.toContain('team-uid');
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses the configured state-history metric name in the alerts union', async () => {
    const original = config.unifiedAlerting.stateHistory;
    config.unifiedAlerting.stateHistory = { prometheusMetricName: 'MY_ALERTS' };
    setDataSources([{ uid: 'k8s-uid', name: 'k8s-prom', isDefault: true }]);
    dataByUid = { 'k8s-uid': 2 };
    try {
      await fetchKubernetesHealth();
      const [health] = healthCalls();
      const alertsExpr = health[0].queries.find((q) => q.refId === 'alertsFiring')?.expr;
      expect(alertsExpr).toBe(
        'count(ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""} or MY_ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""})'
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
      const health = await fetchKubernetesHealth();
      const ashCalls = (run.mock.calls as RunCall[]).filter(([o]) => o.datasource.uid === 'ash-uid');
      expect(ashCalls).toHaveLength(1);
      expect(ashCalls[0][0].queries).toEqual([
        {
          refId: 'grafanaAlertsFiring',
          expr: 'count(GRAFANA_ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""})',
          instant: true,
          range: false,
        },
      ]);
      const [k8sHealth] = healthCalls();
      const alertsExpr = k8sHealth[0].queries.find((q) => q.refId === 'alertsFiring')?.expr;
      expect(alertsExpr).toBe('count(ALERTS{alertstate="firing", alertname!~"Watchdog|InfoInhibitor", cluster!=""})');
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
      const promise = fetchKubernetesHealth();
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
      const promise = fetchKubernetesInventory();
      await jest.advanceTimersByTimeAsync(60_000);
      const inventory = await promise;
      expect(inventory.clusters).toBe(1);
      expect(inventoryCalls()[0][0].datasource.uid).toBe('team-uid');
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects from fetchClusterCpuSeries when no datasource has Kubernetes data', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);

    await expect(fetchClusterCpuSeries()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(cpuCalls()).toHaveLength(0);
  });
});
