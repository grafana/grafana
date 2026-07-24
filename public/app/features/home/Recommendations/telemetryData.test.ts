import { createDataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';
import { type BackendSrv, type DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';

import { resolveBackendInstance } from './probeUtils';
import { runDatasourceQueries } from './promQuery';
import {
  fetchLogsStats,
  fetchLogsVolumeSeries,
  fetchTracesActivity,
  fetchTracesServices,
  LOGS_STATS_LOOKBACK_DAYS,
} from './telemetryData';

jest.mock('./probeUtils', () => ({
  ...jest.requireActual('./probeUtils'),
  resolveBackendInstance: jest.fn(),
}));

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runDatasourceQueries: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const mockResolveBackendInstance = jest.mocked(resolveBackendInstance);
const mockRunDatasourceQueries = jest.mocked(runDatasourceQueries);
const mockProxyGet = jest.fn();

const DATA_LOOKBACK_HOURS = 24;
const NS_IN_MS = 1e6;

const loki: Pick<DataSourceInstanceListItem, 'uid'> = { uid: 'loki-uid' };
const tempo = { uid: 'tempo-uid', type: 'tempo' };

function instanceWith(getResource: jest.Mock): DataSourceWithBackend {
  return { getResource } as unknown as DataSourceWithBackend;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-24T12:00:00Z'));
  mockResolveBackendInstance.mockReset();
  mockRunDatasourceQueries.mockReset();
  mockProxyGet.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ get: mockProxyGet } as unknown as BackendSrv);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('fetchLogsStats', () => {
  it('sums index volume and counts sources over the stats window in nanoseconds', async () => {
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
      if (path === 'label/service_name/values') {
        return { data: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] };
      }
      throw new Error(`unexpected path ${path}`);
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchLogsStats(loki)).resolves.toEqual({ bytes: 47_000_000_000, sources: 8 });

    const end = Date.now() * NS_IN_MS;
    const start = end - LOGS_STATS_LOOKBACK_DAYS * 24 * 3600 * 1e9;
    expect(getResource).toHaveBeenCalledWith('labels', { start, end });
    expect(getResource).toHaveBeenCalledWith('index/volume', {
      query: '{service_name=~".+"}',
      start,
      end,
      limit: 1000,
    });
    expect(getResource).toHaveBeenCalledWith('label/service_name/values', { start, end });
  });

  it('falls back to job when service_name is absent', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'labels') {
        return { data: ['filename', 'job'] };
      }
      if (path === 'index/volume') {
        return { data: { result: [] } };
      }
      return { data: ['a'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchLogsStats(loki)).resolves.toEqual({ bytes: 0, sources: 1 });
    expect(getResource).toHaveBeenCalledWith('label/job/values', expect.anything());
  });

  it('keeps the sources count when the volume endpoint is unavailable', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'labels') {
        return { data: ['job'] };
      }
      if (path === 'index/volume') {
        throw new Error('volume disabled');
      }
      return { data: ['a', 'b'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const promise = fetchLogsStats(loki);
    // withRetry sleeps between volume attempts; drive the fake timers past them.
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(promise).resolves.toEqual({ bytes: null, sources: 2 });
  });

  it('reports nulls when no usable label exists', async () => {
    const getResource = jest.fn(async () => ({ data: ['__stream_shard__'] }));
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchLogsStats(loki)).resolves.toEqual({ bytes: null, sources: null });
    expect(getResource).toHaveBeenCalledTimes(1);
  });
});

describe('fetchLogsVolumeSeries', () => {
  it('sums the volume matrix across labels into one series', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'labels') {
        return { data: ['service_name'] };
      }
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
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const series = await fetchLogsVolumeSeries(loki);

    expect(series?.x?.values).toEqual([1_000_000, 1_060_000]);
    expect(series?.y.values).toEqual([15, 35]);
    const end = Date.now() * NS_IN_MS;
    expect(getResource).toHaveBeenCalledWith('index/volume_range', {
      query: '{service_name=~".+"}',
      start: end - DATA_LOOKBACK_HOURS * 3600 * 1e9,
      end,
      step: '30m',
    });
  });

  it('returns null for a single-point series', async () => {
    const getResource = jest.fn(async (path: string) =>
      path === 'labels' ? { data: ['job'] } : { data: { result: [{ metric: {}, values: [[1_000, '10']] }] } }
    );
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchLogsVolumeSeries(loki)).resolves.toBeNull();
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
  it('reads the throughput series and integrates it into a span count', async () => {
    const frame = createDataFrame({
      refId: 'spans',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'Value', type: FieldType.number, values: [100, 200, 300] },
      ],
    });
    mockRunDatasourceQueries.mockResolvedValue([frame]);

    const activity = await fetchTracesActivity(tempo);

    expect(activity.spans).toBe(600);
    expect(activity.series?.y.values).toEqual([100, 200, 300]);
    expect(mockRunDatasourceQueries).toHaveBeenCalledWith(
      [{ refId: 'spans', queryType: 'traceql', query: '{} | count_over_time()', metricsQueryType: 'range' }],
      expect.objectContaining({ raw: { from: `now-${DATA_LOOKBACK_HOURS}h`, to: 'now' } }),
      tempo
    );
  });

  it('reports null spans when the query returns no numeric data', async () => {
    mockRunDatasourceQueries.mockResolvedValue([]);

    await expect(fetchTracesActivity(tempo)).resolves.toEqual({ spans: null, series: null });
  });
});
