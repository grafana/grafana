import { getAPINamespace } from '@grafana/api-clients';
import {
  createDataFrame,
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  FieldType,
} from '@grafana/data';
import { type BackendSrv, type DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { resolveBackendInstance } from './probeUtils';
import { runInstantQueries, runRangeQuery } from './promQuery';
import {
  fetchLogsActivity,
  fetchMetricsActivity,
  fetchTracesActivity,
  fetchTracesServices,
  LOGS_STATS_LOOKBACK_DAYS,
  METRICS_STATS_LOOKBACK_DAYS,
} from './telemetryData';

jest.mock('./probeUtils', () => ({
  ...jest.requireActual('./probeUtils'),
  resolveBackendInstance: jest.fn(),
}));

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runInstantQueries: jest.fn(),
  runRangeQuery: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  getDataSourceSrv: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

jest.mock('@grafana/api-clients', () => ({
  ...jest.requireActual('@grafana/api-clients'),
  getAPINamespace: jest.fn(),
}));

const mockResolveBackendInstance = jest.mocked(resolveBackendInstance);
const mockRunInstantQueries = jest.mocked(runInstantQueries);
const mockRunRangeQuery = jest.mocked(runRangeQuery);
const mockProxyGet = jest.fn();
const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);
const mockGetAPINamespace = jest.mocked(getAPINamespace);

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
  mockRunInstantQueries.mockReset();
  mockRunInstantQueries.mockResolvedValue([]);
  mockRunRangeQuery.mockReset();
  mockRunRangeQuery.mockResolvedValue([]);
  jest.mocked(getBackendSrv).mockReturnValue({ get: mockProxyGet } as unknown as BackendSrv);
  mockGetDataSourceInstanceSettings.mockReset();
  mockGetDataSourceInstanceSettings.mockResolvedValue(undefined);
  mockGetAPINamespace.mockReset();
  mockGetAPINamespace.mockReturnValue('default');
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
            // Prod aggregateBy=labels collapses this to one total series; two here pin the defensive cross-series sum.
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

    await expect(fetchLogsActivity(loki)).resolves.toEqual({ bytes: null, sources: 2, series: null });
  });

  it('reports nulls when no usable label exists', async () => {
    const getResource = jest.fn(async () => ({ data: ['__stream_shard__'] }));
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchLogsActivity(loki)).resolves.toEqual({ bytes: null, sources: null, series: null });
    expect(getResource).toHaveBeenCalledTimes(1);
  });

  it('reports nulls when the labels lookup itself fails', async () => {
    const getResource = jest.fn().mockRejectedValue(new Error('labels 403'));
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

describe('fetchMetricsActivity', () => {
  const prom = { uid: 'prom-uid', type: 'prometheus' };
  const usageSettings = { uid: 'grafanacloud-usage', type: 'prometheus' } as unknown as DataSourceInstanceSettings;

  const scalarFrame = (refId: string, value: number, labels?: Record<string, string>) =>
    createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values: [value], labels }] });

  it('reads cardinality, name count, hosts, disk pressure, and the series sparkline', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'api/v1/cardinality/label_values') {
        return { series_count_total: 4_200_000 };
      }
      if (path === 'api/v1/label/__name__/values') {
        return { data: ['up', 'node_cpu_seconds_total', 'node_uname_info'] };
      }
      throw new Error(`unexpected path ${path}`);
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));
    mockRunRangeQuery.mockResolvedValue([
      createDataFrame({
        refId: 'series',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1_000, 2_000] },
          { name: 'Value', type: FieldType.number, values: [10, 20] },
        ],
      }),
    ]);
    mockRunInstantQueries.mockImplementation(async (queries) =>
      'eta' in queries
        ? [scalarFrame('eta', 6.4)]
        : [
            scalarFrame('hosts', 12),
            scalarFrame('diskHosts', 3),
            scalarFrame('diskWorst', 0.96, { instance: 'web-03:9100' }),
          ]
    );

    const activity = await fetchMetricsActivity(prom);

    expect(activity.series).toBe(4_200_000);
    expect(activity.names).toBe(3);
    expect(activity.hosts).toBe(12);
    expect(activity.seriesSparkline?.y.values).toEqual([10, 20]);
    expect(activity.disk).toEqual({
      hostsAbove: 3,
      worstInstance: 'web-03:9100',
      worstRatio: 0.96,
      hoursToFull: 6.4,
    });

    const end = Math.floor(Date.now() / 1000);
    expect(getResource).toHaveBeenCalledWith(
      'api/v1/cardinality/label_values',
      { 'label_names[]': '__name__', count_method: 'active' },
      { showErrorAlert: false }
    );
    expect(getResource).toHaveBeenCalledWith(
      'api/v1/label/__name__/values',
      { start: end - METRICS_STATS_LOOKBACK_DAYS * 24 * 3600, end },
      { showErrorAlert: false }
    );
    expect(mockRunRangeQuery).toHaveBeenCalledWith(
      'series',
      'sum(prometheus_tsdb_head_series)',
      DATA_LOOKBACK_HOURS,
      prom
    );
    // The follow-up ETA query pins the worst host by its full instance label.
    expect(mockRunInstantQueries).toHaveBeenCalledWith(
      { eta: expect.stringContaining('instance="web-03:9100"') },
      prom
    );
  });

  it('skips the head-series sparkline on Mimir/Cortex-backed datasources', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue({
      jsonData: { prometheusType: 'Mimir' },
    } as unknown as DataSourceInstanceSettings);
    const getResource = jest.fn(async (path: string) => {
      if (path === 'api/v1/cardinality/label_values') {
        return { series_count_total: 4_200_000 };
      }
      if (path === 'api/v1/label/__name__/values') {
        return { data: ['up'] };
      }
      throw new Error(`unexpected path ${path}`);
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const activity = await fetchMetricsActivity(prom);

    expect(activity.series).toBe(4_200_000);
    expect(activity.seriesSparkline).toBeNull();
    expect(mockRunRangeQuery).not.toHaveBeenCalled();
  });

  it('sources series, sparkline, and ingest rate from the usage datasource on a Cloud stack', async () => {
    mockGetAPINamespace.mockReturnValue('stacks-12345');
    mockGetDataSourceInstanceSettings.mockImplementation(async (ref) =>
      ref === 'grafanacloud-usage'
        ? usageSettings
        : ({ jsonData: { prometheusType: 'Mimir' } } as unknown as DataSourceInstanceSettings)
    );
    const getResource = jest.fn(async (path: string) => {
      if (path === 'api/v1/cardinality/label_values') {
        return { series_count_total: 4_200_000 };
      }
      return { data: ['up'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));
    mockRunInstantQueries.mockImplementation(async (queries, ds) =>
      ds.uid === 'grafanacloud-usage'
        ? [scalarFrame('activeSeries', 9_900_000), scalarFrame('dataPointsPerMinute', 5_160_000)]
        : [scalarFrame('hosts', 12)]
    );
    mockRunRangeQuery.mockResolvedValue([
      createDataFrame({
        refId: 'series',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1_000, 2_000] },
          { name: 'Value', type: FieldType.number, values: [30, 40] },
        ],
      }),
    ]);

    const activity = await fetchMetricsActivity(prom);

    expect(mockRunInstantQueries).toHaveBeenCalledWith(
      {
        activeSeries: 'sum(max by (id) (grafanacloud_instance_active_series{stack_id="12345"}))',
        dataPointsPerMinute: '60 * sum(max by (id) (grafanacloud_instance_samples_per_second{stack_id="12345"}))',
      },
      { uid: 'grafanacloud-usage', type: 'prometheus' }
    );
    // The trend works on Cloud via usage metrics even though the product datasource is Mimir-typed.
    expect(mockRunRangeQuery).toHaveBeenCalledWith(
      'series',
      'sum(max by (id) (grafanacloud_instance_active_series{stack_id="12345"}))',
      DATA_LOOKBACK_HOURS,
      { uid: 'grafanacloud-usage', type: 'prometheus' }
    );
    expect(activity.series).toBe(9_900_000);
    expect(activity.dataPointsPerMinute).toBe(5_160_000);
    expect(activity.seriesSparkline?.y.values).toEqual([30, 40]);
  });

  it('never queries the usage datasource outside a Cloud stack', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue({
      jsonData: { prometheusType: 'Mimir' },
    } as unknown as DataSourceInstanceSettings);
    const getResource = jest.fn(async () => ({ data: ['up'] }));
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));
    mockRunInstantQueries.mockResolvedValue([scalarFrame('hosts', 12)]);

    const activity = await fetchMetricsActivity(prom);

    expect(mockGetDataSourceInstanceSettings).not.toHaveBeenCalledWith('grafanacloud-usage');
    expect(mockRunInstantQueries).toHaveBeenCalledTimes(1);
    expect(mockRunInstantQueries).toHaveBeenCalledWith(expect.not.objectContaining({ dpm: expect.anything() }), prom);
    expect(activity.dataPointsPerMinute).toBeNull();
  });

  it('reads the ingest rate from Prometheus self-monitoring on vanilla datasources', async () => {
    const getResource = jest.fn(async () => ({ data: ['up'] }));
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));
    mockRunInstantQueries.mockResolvedValue([scalarFrame('hosts', 12), scalarFrame('dpm', 250_000)]);

    const activity = await fetchMetricsActivity(prom);

    expect(mockRunInstantQueries).toHaveBeenCalledWith(
      expect.objectContaining({ dpm: '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))' }),
      prom
    );
    expect(activity.dataPointsPerMinute).toBe(250_000);
  });

  it('keeps the prom path when the stack has no usage datasource', async () => {
    mockGetAPINamespace.mockReturnValue('stacks-12345');
    const getResource = jest.fn(async (path: string) => {
      if (path === 'api/v1/cardinality/label_values') {
        return { series_count_total: 4_200_000 };
      }
      return { data: ['up'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const activity = await fetchMetricsActivity(prom);

    expect(activity.series).toBe(4_200_000);
    expect(mockRunRangeQuery).toHaveBeenCalledWith(
      'series',
      'sum(prometheus_tsdb_head_series)',
      DATA_LOOKBACK_HOURS,
      prom
    );
    expect(mockRunInstantQueries).toHaveBeenCalledTimes(1);
    expect(mockRunInstantQueries).toHaveBeenCalledWith(
      expect.objectContaining({ hosts: 'count(node_uname_info)' }),
      prom
    );
  });

  it('falls back to the per-datasource values when usage queries fail', async () => {
    mockGetAPINamespace.mockReturnValue('stacks-12345');
    mockGetDataSourceInstanceSettings.mockImplementation(async (ref) =>
      ref === 'grafanacloud-usage' ? usageSettings : undefined
    );
    const getResource = jest.fn(async (path: string) => {
      if (path === 'api/v1/cardinality/label_values') {
        return { series_count_total: 4_200_000 };
      }
      return { data: ['up'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));
    mockRunInstantQueries.mockImplementation(async (queries, ds) => {
      if (ds.uid === 'grafanacloud-usage') {
        throw new Error('usage unavailable');
      }
      return [scalarFrame('hosts', 12)];
    });
    mockRunRangeQuery.mockRejectedValue(new Error('usage unavailable'));

    const activity = await fetchMetricsActivity(prom);

    expect(activity.series).toBe(4_200_000);
    expect(activity.dataPointsPerMinute).toBeNull();
    expect(activity.seriesSparkline).toBeNull();
    expect(activity.hosts).toBe(12);
  });

  it('falls back to TSDB head stats when the cardinality API is unavailable', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'api/v1/cardinality/label_values') {
        throw new Error('unsupported');
      }
      if (path === 'api/v1/status/tsdb') {
        return { data: { headStats: { numSeries: 987 } } };
      }
      return { data: ['up'] };
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    await expect(fetchMetricsActivity(prom)).resolves.toMatchObject({ series: 987, names: 1 });
  });

  it('keeps the name count when both active-series sources fail', async () => {
    const getResource = jest.fn(async (path: string) => {
      if (path === 'api/v1/label/__name__/values') {
        return { data: ['up', 'process_cpu_seconds_total'] };
      }
      throw new Error('unsupported');
    });
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));

    const promise = fetchMetricsActivity(prom);
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(promise).resolves.toMatchObject({ series: null, names: 2 });
  });

  it('reports no disk pressure and skips the ETA query when nobody is above threshold', async () => {
    const getResource = jest.fn(async () => ({ data: [] }));
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));
    // count() over an empty vector returns an empty result, not zero: no diskHosts frame.
    mockRunInstantQueries.mockResolvedValue([scalarFrame('hosts', 12)]);

    const promise = fetchMetricsActivity(prom);
    await jest.advanceTimersByTimeAsync(10_000);
    const activity = await promise;

    expect(activity.hosts).toBe(12);
    expect(activity.disk).toBeNull();
    expect(mockRunInstantQueries).toHaveBeenCalledTimes(1);
  });

  it.each([90, 0])('drops a meaningless linear ETA (%s h)', async (eta) => {
    const getResource = jest.fn(async () => ({ data: [] }));
    mockResolveBackendInstance.mockResolvedValue(instanceWith(getResource));
    mockRunInstantQueries.mockImplementation(async (queries) =>
      'eta' in queries
        ? [scalarFrame('eta', eta)]
        : [scalarFrame('diskHosts', 1), scalarFrame('diskWorst', 0.93, { instance: 'db-01:9100' })]
    );

    const promise = fetchMetricsActivity(prom);
    await jest.advanceTimersByTimeAsync(10_000);
    const activity = await promise;

    expect(activity.disk).toEqual({
      hostsAbove: 1,
      worstInstance: 'db-01:9100',
      worstRatio: 0.93,
      hoursToFull: null,
    });
  });

  it('resolves all-null without querying when the datasource has no backend instance', async () => {
    mockResolveBackendInstance.mockResolvedValue(null);

    await expect(fetchMetricsActivity(prom)).resolves.toEqual({
      series: null,
      dataPointsPerMinute: null,
      names: null,
      hosts: null,
      seriesSparkline: null,
      disk: null,
    });
    expect(mockRunInstantQueries).not.toHaveBeenCalled();
    expect(mockRunRangeQuery).not.toHaveBeenCalled();
  });
});
