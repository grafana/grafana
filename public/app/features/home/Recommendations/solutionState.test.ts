import { createDataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';
import { type BackendSrv, DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { resolveKubernetesDatasource } from './kubernetesData';
import { runInstantQueries } from './promQuery';
import { tempoHasTraces } from './solutionDataProbes';
import { resetSolutionStateResolution, resolveSolutionState } from './solutionState';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

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
const backendSrvGetMock = jest.fn();

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
    backendSrvGetMock.mockReset();
    // Health pre-filter: every candidate healthy unless a test overrides by uid.
    backendSrvGetMock.mockResolvedValue({ status: 'OK' });
    jest.mocked(getBackendSrv).mockReturnValue({ get: backendSrvGetMock } as unknown as BackendSrv);
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
    expect(resolution.prometheusDatasource).toBeNull();
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

  it('never probes a stack-prefixed utility Loki even when its uid escapes the exclusion set', async () => {
    // Hypothetical provisioning that gives the query-log store an unlisted uid while keeping the
    // stack-prefixed name: the name layer must keep it out of the probe pool, so the (empty)
    // product Loki settles logs inactive.
    setupFixture({
      prometheus: [listItem('prometheus', { uid: 'grafanacloud-usage', name: 'grafanacloud-usage' })],
      loki: [
        listItem('loki', { uid: 'rand0m01', name: 'grafanacloud-acme-usage-insights' }),
        listItem('loki', { uid: 'loki-main', name: 'grafanacloud-acme-logs' }),
      ],
      tempo: [],
      instances: {
        'loki-main': backendInstance(emptyLokiResource()),
      },
    });
    tempoHasTracesMock.mockResolvedValue(false);
    kubernetesMock.mockResolvedValue(null);

    const resolution = await resolveSolutionState();

    expect(resolution.state.logs).toBe('inactive');
    expect(instanceMock).not.toHaveBeenCalledWith({ uid: 'rand0m01' });
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

  it('skips a candidate whose health check fails', async () => {
    freshCloudFixture();
    const withData = jest.fn().mockResolvedValue({ data: ['__name__'] });
    setupFixture({
      prometheus: [
        listItem('prometheus', { uid: 'prom-broken', name: 'broken', isDefault: true }),
        listItem('prometheus', { uid: 'prom-main', name: 'grafanacloud-prom' }),
      ],
      loki: [listItem('loki', { uid: 'loki-main', name: 'grafanacloud-logs' })],
      tempo: [],
      instances: {
        'prom-main': backendInstance(withData),
        'loki-main': backendInstance(emptyLokiResource()),
      },
    });
    backendSrvGetMock.mockImplementation((url: string) =>
      url.includes('prom-broken') ? Promise.reject(new Error('health check failed')) : Promise.resolve({ status: 'OK' })
    );

    const resolution = await resolveSolutionState();

    expect(resolution.state.metrics).toBe('active');
    expect(resolution.prometheusDatasource?.uid).toBe('prom-main');
    // The unhealthy candidate is dropped before its probe could run.
    expect(instanceMock).not.toHaveBeenCalledWith({ uid: 'prom-broken' });
  });

  it('reads inactive when the only candidate with data potential errors', async () => {
    freshCloudFixture();
    const failing = jest.fn().mockRejectedValue(new Error('gateway blew up'));
    setupFixture({
      prometheus: [listItem('prometheus', { uid: 'prom-broken', name: 'broken', isDefault: true })],
      loki: [listItem('loki', { uid: 'loki-main', name: 'grafanacloud-logs' })],
      tempo: [],
      instances: {
        'prom-broken': backendInstance(failing),
        'loki-main': backendInstance(emptyLokiResource()),
      },
    });

    const resolution = await resolveSolutionState();

    expect(resolution.state.metrics).toBe('inactive');
    expect(failing).toHaveBeenCalled();
  });

  it('reads an all-errored traces probe as inactive without touching the other signals', async () => {
    freshCloudFixture();
    tempoHasTracesMock.mockRejectedValue(new Error('tempo down'));

    const resolution = await resolveWithTimers();

    expect(resolution.state.traces).toBe('inactive');
    expect(resolution.state.logs).toBe('inactive');
    expect(resolution.state.metrics).toBe('inactive');
  });

  it('maps a rejecting kubernetes resolution to unknown without forcing metrics', async () => {
    freshCloudFixture();
    kubernetesMock.mockRejectedValue(new Error('all probes failed'));

    const resolution = await resolveWithTimers();

    expect(resolution.state.kubernetes).toBe('unknown');
    // The k8s ⇒ metrics invariant must not fire on unknown.
    expect(resolution.state.metrics).toBe('inactive');
  });

  it('settles a hung probe as no data within the signal budget, preserving siblings', async () => {
    const { lokiResource } = freshCloudFixture();
    lokiResource.mockImplementation(() => new Promise(() => {}));

    const resolution = await resolveWithTimers();

    expect(resolution.state.logs).toBe('inactive');
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

  it('exposes the winning prometheus datasource, falling back to the kubernetes one', async () => {
    const { promResource } = freshCloudFixture();
    promResource.mockResolvedValue({ data: ['__name__'] });

    let resolution = await resolveSolutionState();
    expect(resolution.state.metrics).toBe('active');
    expect(resolution.prometheusDatasource?.uid).toBe('prom-main');

    // Metrics probe empty but kubernetes active: its (Prometheus) datasource carries the card.
    resetSolutionStateResolution();
    promResource.mockResolvedValue({ data: [] });
    kubernetesMock.mockResolvedValue(listItem('prometheus', { uid: 'prom-k8s', name: 'k8s-prom' }));

    resolution = await resolveSolutionState();
    expect(resolution.state.metrics).toBe('active');
    expect(resolution.prometheusDatasource?.uid).toBe('prom-k8s');
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

  it('settles span metrics inactive when a candidate query fails - a dead datasource must not hide the card', async () => {
    setupFixture({
      prometheus: [
        listItem('prometheus', { uid: 'prom-main', name: 'grafanacloud-prom', isDefault: true }),
        listItem('prometheus', { uid: 'prom-demo', name: 'Prometheus Demo' }),
      ],
      loki: [],
      tempo: [],
      instances: { 'prom-main': backendInstance(emptyPromResource()) },
    });
    tempoHasTracesMock.mockResolvedValue(false);
    kubernetesMock.mockResolvedValue(null);
    instantQueriesMock.mockImplementation(async (_queries, ds) => {
      if (ds.uid === 'prom-demo') {
        throw new Error('dial tcp: no such host');
      }
      return [];
    });

    const resolution = await resolveWithTimers();

    expect(resolution.state.spanMetrics).toBe('inactive');
    // Metrics reads the same direction: the errored candidate is no data, not unknown.
    expect(resolution.state.metrics).toBe('inactive');
  });

  it('still settles span metrics active when a healthy candidate has series beside a broken one', async () => {
    freshCloudFixture();
    instantQueriesMock.mockImplementation(async (_queries, ds) => {
      if (ds.uid !== 'prom-main') {
        throw new Error('dial tcp: no such host');
      }
      return [createDataFrame({ refId: 'probe', fields: [{ name: 'Value', type: FieldType.number, values: [12] }] })];
    });

    const resolution = await resolveWithTimers();

    expect(resolution.state.spanMetrics).toBe('active');
  });

  it('probes the label endpoints with the lookback window in each datasource unit', async () => {
    const { promResource, lokiResource } = freshCloudFixture();

    await resolveSolutionState();

    const nowMs = Date.now();
    const silent = { showErrorAlert: false };
    expect(promResource).toHaveBeenCalledWith(
      'api/v1/labels',
      { start: Math.floor(nowMs / 1000) - DATA_LOOKBACK_HOURS * 3600, end: Math.floor(nowMs / 1000) },
      silent
    );
    expect(lokiResource).toHaveBeenCalledWith(
      'labels',
      { start: nowMs * 1e6 - DATA_LOOKBACK_HOURS * 3600 * 1e9, end: nowMs * 1e6 },
      silent
    );
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
