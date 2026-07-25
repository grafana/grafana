import { createDataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { resolveKubernetesDatasource } from './kubernetesData';
import { runInstantQueries } from './promQuery';
import { tempoHasTraces } from './solutionDataProbes';
import {
  CLOUD_UTILITY_LOKI_DATASOURCE_UIDS,
  CLOUD_UTILITY_PROM_DATASOURCE_UIDS,
  resetSolutionStateResolution,
  resolveSolutionState,
} from './solutionState';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
  getDataSourceInstance: jest.fn(),
}));

jest.mock('./solutionDataProbes', () => ({
  ...jest.requireActual('./solutionDataProbes'),
  tempoHasTraces: jest.fn(),
}));

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runInstantQueries: jest.fn(),
}));

jest.mock('./kubernetesData', () => ({
  ...jest.requireActual('./kubernetesData'),
  resolveKubernetesDatasource: jest.fn(),
}));

const listMock = jest.mocked(getDataSourceInstanceList);
const instanceMock = jest.mocked(getDataSourceInstance);
const tempoHasTracesMock = jest.mocked(tempoHasTraces);
const kubernetesMock = jest.mocked(resolveKubernetesDatasource);
const instantQueriesMock = jest.mocked(runInstantQueries);

const DATA_LOOKBACK_HOURS = 24;
const SIGNAL_BUDGET_MS = 30_000;

function listItem(type: string, ds: { uid: string; name?: string; isDefault?: boolean }): DataSourceInstanceListItem {
  return {
    uid: ds.uid,
    name: ds.name ?? ds.uid,
    type,
    meta: { id: type } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: ds.isDefault ?? false,
  };
}

function backendInstance(getResource: jest.Mock): DataSourceWithBackend {
  const instance: DataSourceWithBackend = Object.create(DataSourceWithBackend.prototype);
  instance.getResource = getResource;
  return instance;
}

interface Fixture {
  prometheus?: DataSourceInstanceListItem[];
  loki?: DataSourceInstanceListItem[];
  tempo?: DataSourceInstanceListItem[];
  instances?: Record<string, DataSourceWithBackend>;
}

function setupFixture(fixture: Fixture) {
  listMock.mockImplementation(async (filters) => {
    const list = fixture[(filters?.type ?? '') as keyof Omit<Fixture, 'instances'>];
    if (!list) {
      throw new Error(`No fixture for type ${filters?.type}`);
    }
    return list;
  });
  instanceMock.mockImplementation(async (ref) => {
    const uid = typeof ref === 'string' ? ref : (ref?.uid ?? '');
    const instance = fixture.instances?.[uid];
    if (!instance) {
      throw new Error(`No instance fixture for uid ${uid}`);
    }
    return instance;
  });
}

const emptyPromResource = () => jest.fn().mockResolvedValue({ data: [] });
const emptyLokiResource = () => jest.fn().mockResolvedValue({ data: null });

// A fresh cloud stack: every datasource preinstalled, none with product data.
function freshCloudFixture() {
  const promResource = emptyPromResource();
  const lokiResource = emptyLokiResource();
  setupFixture({
    prometheus: [
      listItem('prometheus', { uid: 'grafanacloud-usage', name: 'grafanacloud-usage' }),
      listItem('prometheus', { uid: 'prom-main', name: 'grafanacloud-prom', isDefault: true }),
    ],
    loki: [
      listItem('loki', { uid: 'grafanacloud-usage-insights' }),
      listItem('loki', { uid: 'grafanacloud-alert-state-history' }),
      listItem('loki', { uid: 'loki-main', name: 'grafanacloud-logs' }),
    ],
    tempo: [listItem('tempo', { uid: 'tempo-main', name: 'grafanacloud-traces' })],
    instances: {
      'prom-main': backendInstance(promResource),
      'loki-main': backendInstance(lokiResource),
    },
  });
  tempoHasTracesMock.mockResolvedValue(false);
  kubernetesMock.mockResolvedValue(null);
  return { promResource, lokiResource };
}

async function resolveWithTimers() {
  const promise = resolveSolutionState();
  await jest.advanceTimersByTimeAsync(SIGNAL_BUDGET_MS + 5_000);
  return promise;
}

describe('resolveSolutionState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-24T12:00:00Z'));
    listMock.mockReset();
    instanceMock.mockReset();
    tempoHasTracesMock.mockReset();
    kubernetesMock.mockReset();
    instantQueriesMock.mockReset();
    // Span-metrics probe settles clean-empty unless a test overrides it.
    instantQueriesMock.mockResolvedValue([]);
    resetSolutionStateResolution();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('settles a fresh cloud stack to all-inactive (presence is not usage)', async () => {
    freshCloudFixture();

    const resolution = await resolveSolutionState();

    expect(resolution.state).toEqual({
      metrics: 'inactive',
      logs: 'inactive',
      traces: 'inactive',
      kubernetes: 'inactive',
      spanMetrics: 'inactive',
    });
    expect(resolution.lokiDatasource).toBeNull();
    expect(resolution.tempoDatasource).toBeNull();
  });

  it('never probes cloud utility datasources, even when they are all there is', async () => {
    setupFixture({
      prometheus: [listItem('prometheus', { uid: 'grafanacloud-usage', name: 'grafanacloud-usage' })],
      loki: [
        listItem('loki', { uid: 'grafanacloud-usage-insights' }),
        listItem('loki', { uid: 'grafanacloud-alert-state-history' }),
      ],
      tempo: [],
    });
    tempoHasTracesMock.mockResolvedValue(false);
    kubernetesMock.mockResolvedValue(null);

    const resolution = await resolveSolutionState();

    expect(resolution.state.metrics).toBe('inactive');
    expect(resolution.state.logs).toBe('inactive');
    expect(instanceMock).not.toHaveBeenCalled();
    expect(instantQueriesMock).not.toHaveBeenCalled();
  });

  it('reports active with the winning datasource when a probe finds data', async () => {
    const { lokiResource } = freshCloudFixture();
    lokiResource.mockResolvedValue({ data: ['job', 'service_name'] });
    tempoHasTracesMock.mockResolvedValue(true);

    const resolution = await resolveSolutionState();

    expect(resolution.state.logs).toBe('active');
    expect(resolution.lokiDatasource?.uid).toBe('loki-main');
    expect(resolution.state.traces).toBe('active');
    expect(resolution.tempoDatasource?.uid).toBe('tempo-main');
  });

  it('treats an errored candidate as unknown when no data was found elsewhere, active when it was', async () => {
    const { promResource } = freshCloudFixture();
    const failing = jest.fn().mockRejectedValue(new Error('gateway blew up'));
    const withData = jest.fn().mockResolvedValue({ data: ['__name__'] });
    setupFixture({
      prometheus: [
        listItem('prometheus', { uid: 'prom-broken', name: 'broken', isDefault: true }),
        listItem('prometheus', { uid: 'prom-main', name: 'grafanacloud-prom' }),
      ],
      loki: [listItem('loki', { uid: 'loki-main', name: 'grafanacloud-logs' })],
      tempo: [],
      instances: {
        'prom-broken': backendInstance(failing),
        'prom-main': backendInstance(withData),
        'loki-main': backendInstance(emptyLokiResource()),
      },
    });

    let resolution = await resolveWithTimers();
    expect(resolution.state.metrics).toBe('active');

    // Same broken candidate, but the healthy one is empty: the errored one may hold data.
    resetSolutionStateResolution();
    failing.mockClear();
    withData.mockResolvedValue({ data: [] });

    resolution = await resolveWithTimers();
    expect(resolution.state.metrics).toBe('unknown');
    expect(promResource).not.toHaveBeenCalled();
  });

  it('maps an all-errored traces probe to unknown without touching the other signals', async () => {
    freshCloudFixture();
    tempoHasTracesMock.mockRejectedValue(new Error('tempo down'));

    const resolution = await resolveWithTimers();

    expect(resolution.state.traces).toBe('unknown');
    expect(resolution.state.logs).toBe('inactive');
    expect(resolution.state.metrics).toBe('inactive');
  });

  it('settles a hung probe to unknown within the signal budget, preserving siblings', async () => {
    const { lokiResource } = freshCloudFixture();
    lokiResource.mockImplementation(() => new Promise(() => {}));

    const resolution = await resolveWithTimers();

    expect(resolution.state.logs).toBe('unknown');
    expect(resolution.state.metrics).toBe('inactive');
    expect(resolution.state.traces).toBe('inactive');
  });

  it('maps a candidate-list rejection to unknown while the aggregate still resolves', async () => {
    freshCloudFixture();
    listMock.mockImplementation(async (filters) => {
      if (filters?.type === 'loki') {
        throw new Error('list unavailable');
      }
      return filters?.type === 'prometheus'
        ? [listItem('prometheus', { uid: 'prom-main', name: 'grafanacloud-prom' })]
        : [];
    });

    const resolution = await resolveWithTimers();

    expect(resolution.state.logs).toBe('unknown');
    expect(resolution.state.metrics).toBe('inactive');
  });

  it('forces metrics active when kubernetes data exists', async () => {
    freshCloudFixture();
    kubernetesMock.mockResolvedValue(listItem('prometheus', { uid: 'prom-main', name: 'grafanacloud-prom' }));

    const resolution = await resolveSolutionState();

    expect(resolution.state.kubernetes).toBe('active');
    expect(resolution.state.metrics).toBe('active');
  });

  it('settles span metrics active when the probe finds series', async () => {
    freshCloudFixture();
    instantQueriesMock.mockResolvedValue([
      createDataFrame({ refId: 'probe', fields: [{ name: 'Value', type: FieldType.number, values: [12] }] }),
    ]);

    const resolution = await resolveSolutionState();

    expect(resolution.state.spanMetrics).toBe('active');
    expect(instantQueriesMock).toHaveBeenCalledWith(
      { probe: expect.stringMatching(/traces_spanmetrics_calls_total.*traces_span_metrics_calls_total/s) },
      expect.objectContaining({ uid: 'prom-main' }),
      expect.any(Number)
    );
  });

  it('settles span metrics unknown when every candidate query fails, without touching siblings', async () => {
    freshCloudFixture();
    instantQueriesMock.mockRejectedValue(new Error('query failed'));

    const resolution = await resolveWithTimers();

    expect(resolution.state.spanMetrics).toBe('unknown');
    expect(resolution.state.metrics).toBe('inactive');
  });

  it('probes the label endpoints with the lookback window in each datasource unit', async () => {
    const { promResource, lokiResource } = freshCloudFixture();

    await resolveSolutionState();

    const nowMs = Date.now();
    expect(promResource).toHaveBeenCalledWith('api/v1/labels', {
      start: Math.floor(nowMs / 1000) - DATA_LOOKBACK_HOURS * 3600,
      end: Math.floor(nowMs / 1000),
    });
    expect(lokiResource).toHaveBeenCalledWith('labels', {
      start: nowMs * 1e6 - DATA_LOOKBACK_HOURS * 3600 * 1e9,
      end: nowMs * 1e6,
    });
  });

  it('fans out once for concurrent callers and re-resolves after a reset', async () => {
    freshCloudFixture();

    await Promise.all([resolveSolutionState(), resolveSolutionState()]);
    // prometheus is listed twice (labels probe + span-metrics probe), loki and tempo once.
    expect(listMock).toHaveBeenCalledTimes(4);

    resetSolutionStateResolution();
    await resolveSolutionState();
    expect(listMock).toHaveBeenCalledTimes(8);
  });
});

describe('cloud utility uid sets', () => {
  it('pin the platform telemetry datasources', () => {
    expect([...CLOUD_UTILITY_PROM_DATASOURCE_UIDS]).toEqual(['grafanacloud-usage', 'grafanacloud-ml-metrics']);
    expect([...CLOUD_UTILITY_LOKI_DATASOURCE_UIDS]).toEqual([
      'grafanacloud-usage-insights',
      'grafanacloud-alert-state-history',
    ]);
  });
});
