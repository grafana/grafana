import { of } from 'rxjs';

import {
  createDataFrame,
  type DataFrame,
  FieldType,
  LoadingState,
  type PanelData,
  type QueryRunner,
} from '@grafana/data';
import { createQueryRunner, type DataSourceSrv, getDataSourceSrv } from '@grafana/runtime';

import { fetchClusterCpuSeries, fetchKubernetesOverview, resetKubernetesPrometheusResolution } from './kubernetesData';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  createQueryRunner: jest.fn(),
}));

const mockGetDataSourceSrv = jest.mocked(getDataSourceSrv);
const mockCreateQueryRunner = jest.mocked(createQueryRunner);

const run = jest.fn();
const destroy = jest.fn();

// Mirrors the k8s app's persisted-choice key (grafana-k8s-app src/constants.ts K8S_STORAGE_KEY).
const K8S_APP_STORAGE_KEY = 'grafana.k8s-app.navigation.storage';

function setDataSources(list: Array<{ uid: string; name: string; isDefault?: boolean }>) {
  const srv = { getList: () => list.map((ds) => ({ ...ds, type: 'prometheus' })) } as unknown as DataSourceSrv;
  mockGetDataSourceSrv.mockReturnValue(srv);
}

// uid -> namespace/cluster count the datasource reports; absent uid = no Kubernetes data there.
let dataByUid: Record<string, number>;
// Probe queries against these uids emit LoadingState.Error (unreachable/erroring datasource).
let probeErrorUids: Set<string>;

type CapturedRun = { datasource: { uid: string }; queries: Array<{ refId: string }> };

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values }] });
}

beforeEach(() => {
  run.mockReset();
  destroy.mockReset();
  mockCreateQueryRunner.mockReset();
  window.localStorage.clear();
  resetKubernetesPrometheusResolution();
  dataByUid = {};
  probeErrorUids = new Set();
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
        const count = dataByUid[uid] ?? 0;
        if (isProbe && probeErrorUids.has(uid)) {
          return of({ state: LoadingState.Error, series: [] as DataFrame[], timeRange: {} } as PanelData);
        }
        let series: DataFrame[] = [];
        if (isProbe && count > 0) {
          series = [numberFrame('namespaces', [count])];
        } else if (!isProbe && count > 0 && (captured?.queries.some((q) => q.refId === 'clusters') ?? false)) {
          // Overview batch: answer with a clusters value so positive tests assert the render gate.
          series = [numberFrame('clusters', [count])];
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
const overviewCalls = () =>
  (run.mock.calls as RunCall[]).filter(([o]) => o.queries.some((q) => q.refId === 'clusters'));
const cpuCalls = () => (run.mock.calls as RunCall[]).filter(([o]) => o.queries[0].refId === 'cpu');

describe('Kubernetes Prometheus resolution', () => {
  it('picks the stored k8s-app choice over an isDefault sibling when both have data', async () => {
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, JSON.stringify({ promName: 'k8s-prom' }));
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'k8s-uid', name: 'k8s-prom' },
    ]);
    dataByUid = { 'default-uid': 3, 'k8s-uid': 2 };

    const overview = await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('k8s-uid');
    expect(overview.clusters).toBeGreaterThan(0);
  });

  it('skips a default datasource without namespace data for a sibling that has it', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'team-uid': 1 };

    const overview = await fetchKubernetesOverview();

    expect(overview.clusters).toBe(1);
    expect(overviewCalls()[0][0].datasource.uid).toBe('team-uid');
    const probedUids = probeCalls().map(([o]) => o.datasource.uid);
    expect(probedUids).toEqual(expect.arrayContaining(['default-uid', 'team-uid']));
  });

  it('falls through from a stored choice without data to the default that has it', async () => {
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, JSON.stringify({ promName: 'k8s-prom' }));
    setDataSources([
      { uid: 'k8s-uid', name: 'k8s-prom' },
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
    ]);
    dataByUid = { 'default-uid': 4 };

    const overview = await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('default-uid');
    expect(overview.clusters).toBe(4);
  });

  it('rejects when no datasource has Kubernetes data, and never runs the overview', async () => {
    setDataSources([
      { uid: 'a-uid', name: 'a-prom' },
      { uid: 'b-uid', name: 'b-prom' },
    ]);

    await expect(fetchKubernetesOverview()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(overviewCalls()).toHaveLength(0);
  });

  it('does not probe utility datasources when a non-utility one exists', async () => {
    setDataSources([
      { uid: 'usage-uid', name: 'grafanacloud-usage' },
      { uid: 'ml-uid', name: 'grafanacloud-ml-metrics' },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'usage-uid': 9, 'ml-uid': 9, 'team-uid': 2 };

    await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('team-uid');
    const probedUids = probeCalls().map(([o]) => o.datasource.uid);
    expect(probedUids).not.toContain('usage-uid');
    expect(probedUids).not.toContain('ml-uid');
  });

  it('still probes and picks a lone utility-named datasource', async () => {
    setDataSources([{ uid: 'usage-uid', name: 'grafanacloud-usage' }]);
    dataByUid = { 'usage-uid': 1 };

    const overview = await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('usage-uid');
    expect(overview.clusters).toBe(1);
  });

  it('keeps a user datasource whose name merely contains "usage" (exact-match skip)', async () => {
    setDataSources([
      { uid: 'a', name: 'cpu-usage-prom', isDefault: true },
      { uid: 'b', name: 'team-prom' },
    ]);
    dataByUid = { a: 1, b: 1 };

    const overview = await fetchKubernetesOverview();

    // Substring matching would demote 'cpu-usage-prom'; exact-match leaves this default in place.
    expect(overviewCalls()[0][0].datasource.uid).toBe('a');
    expect(overview.clusters).toBe(1);
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

    const overview = await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('default-uid');
    expect(overview.clusters).toBe(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects and queries nothing when there are no datasources', async () => {
    setDataSources([]);

    await expect(fetchKubernetesOverview()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(run).not.toHaveBeenCalled();
  });

  it('shares one resolution across both fetchers; a missing cpu metric returns null', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);
    dataByUid = { 'only-uid': 1 };

    await fetchKubernetesOverview();
    const cpu = await fetchClusterCpuSeries();

    expect(probeCalls()).toHaveLength(1);
    expect(cpuCalls()[0][0].datasource.uid).toBe('only-uid');
    expect(cpu).toBeNull();
  });

  it('probes only the first ten candidates, truncating lower-priority ones', async () => {
    setDataSources(Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}` })));
    dataByUid = { 'p11-uid': 1 };

    await expect(fetchKubernetesOverview()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(probeCalls()).toHaveLength(10);
  });

  it('still probes a stored choice that sits beyond the probe cap', async () => {
    window.localStorage.setItem(K8S_APP_STORAGE_KEY, JSON.stringify({ promName: 'p11' }));
    setDataSources(Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}` })));
    dataByUid = { 'p11-uid': 1 };

    const overview = await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('p11-uid');
    expect(overview.clusters).toBe(1);
  });

  it('still probes a default datasource that sits beyond the probe cap', async () => {
    setDataSources(
      Array.from({ length: 11 }, (_, i) => ({ uid: `p${i + 1}-uid`, name: `p${i + 1}`, isDefault: i === 10 }))
    );
    dataByUid = { 'p11-uid': 1 };

    const overview = await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('p11-uid');
    expect(overview.clusters).toBe(1);
  });

  it('treats a probe error on a high-priority datasource as no data and falls through', async () => {
    setDataSources([
      { uid: 'default-uid', name: 'default-prom', isDefault: true },
      { uid: 'team-uid', name: 'team-prom' },
    ]);
    dataByUid = { 'default-uid': 5, 'team-uid': 1 };
    probeErrorUids = new Set(['default-uid']);

    const overview = await fetchKubernetesOverview();

    expect(overviewCalls()[0][0].datasource.uid).toBe('team-uid');
    expect(overview.clusters).toBe(1);
  });

  it('rejects when every probe errors', async () => {
    setDataSources([
      { uid: 'a-uid', name: 'a-prom' },
      { uid: 'b-uid', name: 'b-prom' },
    ]);
    dataByUid = { 'a-uid': 3, 'b-uid': 3 };
    probeErrorUids = new Set(['a-uid', 'b-uid']);

    await expect(fetchKubernetesOverview()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(overviewCalls()).toHaveLength(0);
  });

  it('rejects from fetchClusterCpuSeries when no datasource has Kubernetes data', async () => {
    setDataSources([{ uid: 'only-uid', name: 'only-prom' }]);

    await expect(fetchClusterCpuSeries()).rejects.toThrow('No Prometheus datasource with Kubernetes data');
    expect(cpuCalls()).toHaveLength(0);
  });
});
