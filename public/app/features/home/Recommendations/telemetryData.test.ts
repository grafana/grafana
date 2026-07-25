import { type DataSourceInstanceListItem } from '@grafana/data';
import { type BackendSrv, type DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';

import { resolveBackendInstance } from './probeUtils';
import { fetchLogsActivity, fetchTracesActivity, fetchTracesServices, LOGS_STATS_LOOKBACK_DAYS } from './telemetryData';

jest.mock('./probeUtils', () => ({
  ...jest.requireActual('./probeUtils'),
  resolveBackendInstance: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockResolveBackendInstance = jest.mocked(resolveBackendInstance);
const mockProxyGet = jest.fn();

const DATA_LOOKBACK_HOURS = 24;
const NS_IN_MS = 1e6;

const loki: Pick<DataSourceInstanceListItem, 'uid'> = { uid: 'loki-uid' };
const tempo = { uid: 'tempo-uid' };

function instanceWith(getResource: jest.Mock): DataSourceWithBackend {
  return { getResource } as unknown as DataSourceWithBackend;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-24T12:00:00Z'));
  mockResolveBackendInstance.mockReset();
  mockProxyGet.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ get: mockProxyGet } as unknown as BackendSrv);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('fetchLogsActivity', () => {
  it('sums index volume, counts sources, and builds the ingest series over the right windows', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'labels') {
        return { data: ['filename', 'job', 'service_name'] };
      }
      if (path === 'index/volume') {
        return {
          data: {
            result: [
              { metric: { service_name: 'a' }, value: [1, '30000000000'] },
              { metric: { service_name: 'b' }, value: [1, '17000000000'] },
            ],
          },
        };
      }
      if (path === 'index/volume_range') {
        return {
          data: {
            result: [
              {
                metric: { service_name: 'a' },
                values: [
                  [1_000, '10'],
                  [1_060, '20'],
                ],
              },
              {
                metric: { service_name: 'b' },
                values: [
                  [1_000, '5'],
                  [1_060, '15'],
                ],
              },
            ],
          },
        };
      }
      if (path === 'label/service_name/values') {
        return { data: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] };
      }
      throw new Error(`unexpected path ${path}`);
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const activity = await fetchLogsActivity(loki);

    expect(activity.bytes).toBe(47_000_000_000);
    expect(activity.sources).toBe(8);
    expect(activity.series?.x?.values).toEqual([1_000_000, 1_060_000]);
    expect(activity.series?.y.values).toEqual([15, 35]);

    const end = Date.now() * NS_IN_MS;
    const statsStart = end - LOGS_STATS_LOOKBACK_DAYS * 24 * 3600 * 1e9;
    const silent = { showErrorAlert: false };
    expect(getResource).toHaveBeenCalledWith('labels', { start: statsStart, end }, silent);
    expect(getResource).toHaveBeenCalledWith(
      'index/volume',
      { query: '{service_name=~".+"}', start: statsStart, end, aggregateBy: 'labels', targetLabels: 'service_name' },
      silent
    );
    expect(getResource).toHaveBeenCalledWith('label/service_name/values', { start: statsStart, end }, silent);
    expect(getResource).toHaveBeenCalledWith(
      'index/volume_range',
      {
        query: '{service_name=~".+"}',
        start: end - DATA_LOOKBACK_HOURS * 3600 * 1e9,
        end,
        step: '30m',
        aggregateBy: 'labels',
        targetLabels: 'service_name',
      },
      silent
    );
  });

  it('falls back to job when service_name is absent', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'labels') {
        return { data: ['filename', 'job'] };
      }
      if (path === 'index/volume') {
        return { data: { result: [] } };
      }
      if (path === 'index/volume_range') {
        return { data: { result: [] } };
      }
      return { data: ['a'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchLogsActivity(loki)).resolves.toEqual({ bytes: 0, sources: 1, series: null });
    expect(getResource).toHaveBeenCalledWith('label/job/values', expect.anything(), expect.anything());
  });

  it('keeps the other fields when one endpoint is unavailable', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'labels') {
        return { data: ['job'] };
      }
      if (path === 'index/volume' || path === 'index/volume_range') {
        throw new Error('volume disabled');
      }
      return { data: ['a', 'b'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const promise = fetchLogsActivity(loki);
    // withRetry sleeps between volume attempts; drive the fake timers past them.
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(promise).resolves.toEqual({ bytes: null, sources: 2, series: null });
  });

  it('reports nulls when no usable label exists', async () => {
    const getResource = jest.fn(async () => ({ data: ['__stream_shard__'] }));
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchLogsActivity(loki)).resolves.toEqual({ bytes: null, sources: null, series: null });
    expect(getResource).toHaveBeenCalledTimes(1);
  });

  it('drops a single-point series', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'labels') {
        return { data: ['job'] };
      }
      if (path === 'index/volume_range') {
        return { data: { result: [{ metric: {}, values: [[1_000, '10']] }] } };
      }
      return { data: [] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const activity = await fetchLogsActivity(loki);

    expect(activity.series).toBeNull();
  });
});

describe('fetchTracesServices', () => {
  it('counts tag values through the datasource proxy over the lookback in unix seconds', async () => {
    mockProxyGet.mockResolvedValue({ tagValues: [{ value: 'a' }, { value: 'b' }] });

    await expect(fetchTracesServices(tempo)).resolves.toBe(2);

    const end = Math.floor(Date.now() / 1000);
    expect(mockProxyGet).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/tempo-uid/api/v2/search/tag/resource.service.name/values',
      { start: end - DATA_LOOKBACK_HOURS * 3600, end },
      undefined,
      { showErrorAlert: false }
    );
  });
});

describe('fetchTracesActivity', () => {
  it('sums the query_range samples into a span count and throughput series', async () => {
    mockProxyGet.mockResolvedValue({
      series: [
        {
          samples: [
            { timestampMs: '1000', value: 100 },
            { timestampMs: '2000', value: 200 },
            { timestampMs: '3000', value: 300 },
          ],
        },
      ],
    });

    const activity = await fetchTracesActivity(tempo);

    expect(activity.spans).toBe(600);
    expect(activity.series?.x?.values).toEqual([1000, 2000, 3000]);
    expect(activity.series?.y.values).toEqual([100, 200, 300]);
    const end = Math.floor(Date.now() / 1000);
    expect(mockProxyGet).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/tempo-uid/api/metrics/query_range',
      { q: '{} | count_over_time()', start: end - DATA_LOOKBACK_HOURS * 3600, end, step: '30m' },
      undefined,
      { showErrorAlert: false }
    );
  });

  it('reports null spans when the response has no samples', async () => {
    mockProxyGet.mockResolvedValue({ series: [] });

    await expect(fetchTracesActivity(tempo)).resolves.toEqual({ spans: null, series: null });
  });
});
