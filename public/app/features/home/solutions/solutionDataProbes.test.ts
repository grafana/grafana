import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrv, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { probeFound, tempoHasTraces } from './solutionDataProbes';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockList = jest.mocked(getDataSourceInstanceList);
const mockProxyGet = jest.fn();

function datasource(type: string, name = `${type}-ds`): DataSourceInstanceListItem {
  return {
    uid: name,
    name,
    type,
    meta: { id: type } as DataSourceInstanceListItem['meta'],
    readOnly: false,
    isDefault: false,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-24T12:00:00Z'));
  mockList.mockReset();
  mockProxyGet.mockReset();
  // Health checks share getBackendSrv().get: answer /health OK by default so candidates survive the filter.
  mockProxyGet.mockImplementation(async (url: string) => (url.endsWith('/health') ? { status: 'OK' } : undefined));
  jest.mocked(getBackendSrv).mockReturnValue({ get: mockProxyGet } as unknown as BackendSrv);
});

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
    expect(hasData).toHaveBeenCalledWith(expect.objectContaining({ uid: 'healthy' }));
  });

  it('never probes excluded uids', async () => {
    mockList.mockResolvedValue([datasource('loki', 'excluded'), datasource('loki', 'kept')]);

    const hasData = jest.fn().mockResolvedValue(true);
    const found = await probeFound('loki', hasData, new Set(['excluded']));

    expect(found?.name).toBe('kept');
    expect(hasData).toHaveBeenCalledTimes(1);
    expect(hasData).toHaveBeenCalledWith(expect.objectContaining({ uid: 'kept' }));
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
