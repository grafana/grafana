import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrv, config, DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { resetProbeHealth } from './probeUtils';
import {
  lokiHasRecentLabels,
  lokiRecentLabels,
  probeFound,
  prometheusHasRecentMetrics,
  resetLokiLabels,
  tempoHasTraces,
} from './solutionDataProbes';

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
  resetProbeHealth();
  resetLokiLabels();
  // Health checks share getBackendSrv().get: answer /health OK by default so every candidate is probed.
  mockProxyGet.mockImplementation(async (url: string) => (url.endsWith('/health') ? { status: 'OK' } : undefined));
  jest.mocked(getBackendSrv).mockReturnValue({ get: mockProxyGet } as unknown as BackendSrv);
});

function backendInstance(getResource: jest.Mock): DataSourceWithBackend {
  const instance: DataSourceWithBackend = Object.create(DataSourceWithBackend.prototype);
  instance.getResource = getResource;
  return instance;
}

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
      { showErrorAlert: false }
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

  it('shares one label request per datasource', async () => {
    const getResource = jest.fn().mockResolvedValue({ data: ['job', 'service_name'] });
    mockInstance.mockResolvedValue(backendInstance(getResource));
    const ds = datasource('loki');

    await expect(lokiHasRecentLabels(ds)).resolves.toBe(true);
    await expect(lokiRecentLabels(ds.uid)).resolves.toEqual(['job', 'service_name']);

    expect(getResource).toHaveBeenCalledTimes(1);
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
      { showErrorAlert: false }
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
});

describe('tempoHasTraces', () => {
  it('reports data when the Tempo search API returns a trace', async () => {
    mockProxyGet.mockResolvedValue({ traces: [{ traceID: 'abc' }] });

    await expect(tempoHasTraces(datasource('tempo'))).resolves.toBe(true);

    const end = Math.floor(Date.now() / 1000);
    expect(mockProxyGet).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/tempo-ds/api/search',
      { q: '{}', limit: 1, start: end - 24 * 3600, end },
      undefined,
      { showErrorAlert: false }
    );
  });

  it('reports no data when the Tempo search is empty', async () => {
    mockProxyGet.mockResolvedValue({ traces: [] });

    await expect(tempoHasTraces(datasource('tempo'))).resolves.toBe(false);
  });

  it('throws when the search endpoint fails', async () => {
    mockProxyGet.mockRejectedValue(new Error('HTTP 404'));

    await expect(tempoHasTraces(datasource('tempo'))).rejects.toThrow('HTTP 404');
  });
});
