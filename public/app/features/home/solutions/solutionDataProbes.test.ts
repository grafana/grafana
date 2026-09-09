import { of, throwError } from 'rxjs';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrv, config, DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { PROBE_TIMEOUT_MS, resetProbeHealth } from './probeUtils';
import { lokiHasRecentLabels, probeFound, prometheusHasRecentMetrics, tempoHasTraces } from './solutionDataProbes';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  getDataSourceInstanceList: jest.fn(),
}));

const mockList = jest.mocked(getDataSourceInstanceList);
const mockInstance = jest.mocked(getDataSourceInstance);
const mockProxyGet = jest.fn();
const mockProxyFetch = jest.fn();

function datasource(type: string, name = `${type}-ds`): DataSourceInstanceListItem {
  return {
    uid: name,
    name,
    type,
    meta: { id: type } as DataSourceInstanceListItem['meta'],
    isDefault: false,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-24T12:00:00Z'));
  mockList.mockReset();
  mockInstance.mockReset();
  mockProxyGet.mockReset();
  mockProxyFetch.mockReset();
  resetProbeHealth();
  // Health checks share getBackendSrv().get: answer /health OK by default so every candidate is probed.
  mockProxyGet.mockImplementation(async (url: string) => (url.endsWith('/health') ? { status: 'OK' } : undefined));
  jest.mocked(getBackendSrv).mockReturnValue({ get: mockProxyGet, fetch: mockProxyFetch } as unknown as BackendSrv);
});

function backendInstance(getResource: jest.Mock): DataSourceWithBackend {
  const instance: DataSourceWithBackend = Object.create(DataSourceWithBackend.prototype);
  instance.getResource = getResource;
  return instance;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () => jest.advanceTimersByTimeAsync(0);

afterEach(() => {
  jest.useRealTimers();
});

describe('probeFound', () => {
  it('returns the first candidate that confirms data', async () => {
    mockList.mockResolvedValue([datasource('tempo', 'first'), datasource('tempo', 'second')]);

    const found = await probeFound('tempo', async (ds) => ds.name === 'second');

    expect(found?.name).toBe('second');
  });

  it('settles null when every candidate probes clean-and-empty', async () => {
    mockList.mockResolvedValue([datasource('tempo')]);

    await expect(probeFound('tempo', async () => false)).resolves.toBeNull();
  });

  it('settles null for an empty candidate list', async () => {
    mockList.mockResolvedValue([]);

    const hasData = jest.fn();
    await expect(probeFound('tempo', hasData)).resolves.toBeNull();
    expect(hasData).not.toHaveBeenCalled();
  });

  it('settles null when a candidate errored and no data was found elsewhere', async () => {
    mockList.mockResolvedValue([datasource('tempo', 'broken'), datasource('tempo', 'empty')]);

    await expect(
      probeFound('tempo', async (ds) => {
        if (ds.name === 'broken') {
          throw new Error('probe failed');
        }
        return false;
      })
    ).resolves.toBeNull();
  });

  it('never probes an unhealthy candidate', async () => {
    mockList.mockResolvedValue([datasource('loki', 'broken'), datasource('loki', 'healthy')]);
    mockProxyGet.mockImplementation((url: string) =>
      url.includes('broken') ? Promise.reject(new Error('health check failed')) : Promise.resolve({ status: 'OK' })
    );

    const hasData = jest.fn().mockResolvedValue(true);
    const found = await probeFound('loki', hasData);

    expect(found?.name).toBe('healthy');
    expect(hasData).toHaveBeenCalledTimes(1);
    expect(hasData).toHaveBeenCalledWith(expect.objectContaining({ uid: 'healthy' }), expect.any(AbortSignal));
  });

  it('never probes excluded uids', async () => {
    mockList.mockResolvedValue([datasource('loki', 'excluded'), datasource('loki', 'kept')]);

    const hasData = jest.fn().mockResolvedValue(true);
    const found = await probeFound('loki', hasData, new Set(['excluded']));

    expect(found?.name).toBe('kept');
    expect(hasData).toHaveBeenCalledTimes(1);
    expect(hasData).toHaveBeenCalledWith(expect.objectContaining({ uid: 'kept' }), expect.any(AbortSignal));
  });
});

describe('lokiHasRecentLabels', () => {
  it('queries Loki label metadata over the shared lookback in nanoseconds', async () => {
    const getResource = jest.fn().mockResolvedValue({ data: ['job', 'service_name'] });
    mockInstance.mockResolvedValue(backendInstance(getResource));

    await expect(lokiHasRecentLabels(datasource('loki'))).resolves.toBe(true);

    const end = Date.now() * 1e6;
    expect(getResource).toHaveBeenCalledWith(
      'labels',
      { start: end - 24 * 3600 * 1e9, end },
      { showErrorAlert: false, abortSignal: expect.any(AbortSignal) }
    );
  });

  it('reports no data on an empty list', async () => {
    const getResource = jest.fn().mockResolvedValue({ data: null });
    mockInstance.mockResolvedValue(backendInstance(getResource));

    await expect(lokiHasRecentLabels(datasource('loki'))).resolves.toBe(false);
  });

  it('reports no data when the datasource cannot make resource calls', async () => {
    mockInstance.mockResolvedValue({} as never);

    await expect(lokiHasRecentLabels(datasource('loki'))).resolves.toBe(false);
  });

  it('ignores non-string entries', async () => {
    const getResource = jest.fn().mockResolvedValue({ data: [null, {}] });
    mockInstance.mockResolvedValue(backendInstance(getResource));

    await expect(lokiHasRecentLabels(datasource('loki'))).resolves.toBe(false);

    getResource.mockResolvedValue({ data: [null, 'job'] });
    await expect(lokiHasRecentLabels(datasource('loki'))).resolves.toBe(true);
  });

  it('probes again with a fresh signal after an earlier probe of the same datasource was aborted', async () => {
    const getResource = jest.fn(async (_path: string, _params: unknown, options: { abortSignal: AbortSignal }) => {
      if (options.abortSignal.aborted) {
        throw new Error('aborted');
      }
      return { data: ['job'] };
    });
    mockInstance.mockResolvedValue(backendInstance(getResource));
    const ds = datasource('loki');

    const first = new AbortController();
    await expect(lokiHasRecentLabels(ds, first.signal)).resolves.toBe(true);
    first.abort();
    jest.setSystemTime(Date.now() + 61_000);

    await expect(lokiHasRecentLabels(ds, new AbortController().signal)).resolves.toBe(true);
    expect(getResource).toHaveBeenCalledTimes(2);
    expect(getResource.mock.calls[1][2].abortSignal.aborted).toBe(false);
  });

  it('never issues the request when the lookup outlives the deadline', async () => {
    const lookup = deferred<DataSourceWithBackend>();
    mockInstance.mockReturnValue(lookup.promise);
    const getResource = jest.fn();

    const assertion = expect(lokiHasRecentLabels(datasource('loki'))).rejects.toThrow(/timed out/);
    await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    await assertion;

    lookup.resolve(backendInstance(getResource));
    await flush();
    expect(getResource).not.toHaveBeenCalled();
  });
});

describe('prometheusHasRecentMetrics', () => {
  it('asks for one name more than it excludes over the shared lookback', async () => {
    const getResource = jest.fn().mockResolvedValue({ data: ['ALERTS', 'ALERTS_FOR_STATE', 'GRAFANA_ALERTS', 'up'] });
    mockInstance.mockResolvedValue(backendInstance(getResource));

    await expect(prometheusHasRecentMetrics(datasource('prometheus'))).resolves.toBe(true);

    const end = Math.floor(Date.now() / 1000);
    expect(getResource).toHaveBeenCalledWith(
      'api/v1/label/__name__/values',
      { start: end - 24 * 3600, end, limit: 4 },
      { showErrorAlert: false, abortSignal: expect.any(AbortSignal) }
    );
  });

  it('ignores alert-state series but counts real telemetry', async () => {
    const getResource = jest.fn().mockResolvedValue({ data: ['ALERTS', 'ALERTS_FOR_STATE', 'GRAFANA_ALERTS'] });
    mockInstance.mockResolvedValue(backendInstance(getResource));

    await expect(prometheusHasRecentMetrics(datasource('prometheus'))).resolves.toBe(false);

    getResource.mockResolvedValue({ data: ['ALERTS', 'node_uname_info'] });
    await expect(prometheusHasRecentMetrics(datasource('prometheus'))).resolves.toBe(true);
  });

  it('excludes the configured Grafana alert-state metric instead of the default name', async () => {
    const original = config.unifiedAlerting.stateHistory;
    config.unifiedAlerting.stateHistory = { prometheusMetricName: 'MY_ALERTS' };
    try {
      const getResource = jest.fn().mockResolvedValue({ data: ['MY_ALERTS'] });
      mockInstance.mockResolvedValue(backendInstance(getResource));

      await expect(prometheusHasRecentMetrics(datasource('prometheus'))).resolves.toBe(false);
      expect(getResource).toHaveBeenCalledWith('api/v1/label/__name__/values', expect.objectContaining({ limit: 4 }), {
        showErrorAlert: false,
        abortSignal: expect.any(AbortSignal),
      });

      getResource.mockResolvedValue({ data: ['MY_ALERTS', 'up'] });
      await expect(prometheusHasRecentMetrics(datasource('prometheus'))).resolves.toBe(true);
    } finally {
      config.unifiedAlerting.stateHistory = original;
    }
  });

  it('counts metric names that collide with Object.prototype properties', async () => {
    const getResource = jest.fn().mockResolvedValue({ data: ['constructor'] });
    mockInstance.mockResolvedValue(backendInstance(getResource));

    await expect(prometheusHasRecentMetrics(datasource('prometheus'))).resolves.toBe(true);
  });

  it('cancels the request when the probe deadline passes', async () => {
    const getResource = jest.fn().mockReturnValue(new Promise(() => {}));
    mockInstance.mockResolvedValue(backendInstance(getResource));

    const assertion = expect(prometheusHasRecentMetrics(datasource('prometheus'))).rejects.toThrow(/timed out/);
    await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

    await assertion;
    expect(getResource.mock.calls[0][2].abortSignal.aborted).toBe(true);
  });

  it('never issues the request when the lookup outlives the deadline', async () => {
    const lookup = deferred<DataSourceWithBackend>();
    mockInstance.mockReturnValue(lookup.promise);
    const getResource = jest.fn();

    const assertion = expect(prometheusHasRecentMetrics(datasource('prometheus'))).rejects.toThrow(/timed out/);
    await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    await assertion;

    lookup.resolve(backendInstance(getResource));
    await flush();
    expect(getResource).not.toHaveBeenCalled();
  });
});

describe('tempoHasTraces', () => {
  it('reports data when the Tempo search API returns a trace', async () => {
    mockProxyFetch.mockReturnValue(of({ data: { traces: [{ traceID: 'abc' }] } }));

    await expect(tempoHasTraces(datasource('tempo'))).resolves.toBe(true);

    const end = Math.floor(Date.now() / 1000);
    expect(mockProxyFetch).toHaveBeenCalledWith({
      url: '/api/datasources/proxy/uid/tempo-ds/api/search',
      params: { q: '{}', limit: 1, start: end - 24 * 3600, end },
      method: 'GET',
      showErrorAlert: false,
      abortSignal: expect.any(AbortSignal),
    });
  });

  it('reports no data when the Tempo search is empty', async () => {
    mockProxyFetch.mockReturnValue(of({ data: { traces: [] } }));

    await expect(tempoHasTraces(datasource('tempo'))).resolves.toBe(false);
  });

  it('throws when the search endpoint fails', async () => {
    mockProxyFetch.mockReturnValue(throwError(() => new Error('HTTP 404')));

    await expect(tempoHasTraces(datasource('tempo'))).rejects.toThrow('HTTP 404');
  });
});
