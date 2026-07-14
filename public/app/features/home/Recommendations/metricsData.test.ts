import { of } from 'rxjs';

import {
  createDataFrame,
  type DataFrame,
  type DataSourceInstanceListItem,
  FieldType,
  LoadingState,
  type PanelData,
  type QueryRunner,
} from '@grafana/data';
import { createQueryRunner } from '@grafana/runtime';
import { getDataSourceInstanceList, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { fetchMetricsHistory, fetchMetricsOverview, type MetricsOverview } from './metricsData';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  createQueryRunner: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockCreateQueryRunner = jest.mocked(createQueryRunner);
const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);
const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);
const run = jest.fn();
const destroy = jest.fn();

type CapturedRun = {
  datasource: { uid: string };
  queries: Array<{ refId: string; expr: string; instant: boolean; range: boolean }>;
  timeRange: { raw: { from: string } };
};

const instantValues: Record<string, number | undefined> = {};
let ossActiveSeries: number | undefined;

function setDataSources(list: Array<{ uid: string; name: string; isDefault?: boolean }>) {
  const datasources = list.map(
    (datasource) =>
      ({ ...datasource, type: 'prometheus', isDefault: datasource.isDefault ?? false }) as DataSourceInstanceListItem
  );
  mockGetDataSourceInstanceList.mockResolvedValue(datasources);
  mockGetDataSourceInstanceSettings.mockResolvedValue(
    (datasources.find((datasource) => datasource.isDefault) ?? datasources[0]) as Awaited<
      ReturnType<typeof getDataSourceInstanceSettings>
    >
  );
}

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values }] });
}

beforeEach(() => {
  Object.assign(instantValues, { activeSeries: 4200000, dataPointsPerMinute: 5160000 });
  ossActiveSeries = undefined;
  run.mockReset();
  destroy.mockReset();
  mockCreateQueryRunner.mockReset();
  mockGetDataSourceInstanceList.mockReset();
  mockGetDataSourceInstanceSettings.mockReset();
  mockCreateQueryRunner.mockImplementation(() => {
    let captured: CapturedRun | undefined;
    return {
      run: (options: CapturedRun) => {
        captured = options;
        run(options);
      },
      get: () => {
        const queries = captured?.queries ?? [];
        const series = queries[0]?.range
          ? [
              createDataFrame({
                refId: queries[0].refId,
                fields: [
                  { name: 'Time', type: FieldType.time, values: [0, 1000, 2000] },
                  { name: 'Value', type: FieldType.number, values: [100, 110, 120] },
                ],
              }),
            ]
          : queries.flatMap((query) => {
              const value =
                query.refId === 'activeSeries' && captured?.datasource.uid !== 'usage-uid'
                  ? ossActiveSeries
                  : instantValues[query.refId];
              return value === undefined ? [] : [numberFrame(query.refId, [value])];
            });
        return of({ state: LoadingState.Done, series, timeRange: {} } as PanelData);
      },
      cancel: jest.fn(),
      destroy,
    } as unknown as QueryRunner;
  });
});

afterEach(() => jest.restoreAllMocks());

describe('Metrics data', () => {
  it('queries Grafana Cloud usage for active series and sample rate', async () => {
    setDataSources([
      { uid: 'team-prom', name: 'team-prom', isDefault: true },
      { uid: 'usage-uid', name: 'grafanacloud-usage' },
    ]);

    await expect(fetchMetricsOverview()).resolves.toEqual({
      activeSeries: 4200000,
      activeSeriesSource: 'cloud',
      dataPointsPerMinute: 5160000,
    });

    const options = run.mock.calls[0][0] as CapturedRun;
    expect(options.datasource.uid).toBe('usage-uid');
    expect(Object.fromEntries(options.queries.map((query) => [query.refId, query.expr]))).toEqual({
      activeSeries: 'sum(grafanacloud_instance_active_series)',
      dataPointsPerMinute: '60 * sum(grafanacloud_instance_samples_per_second)',
    });
    expect(options.queries.every((query) => query.instant && !query.range)).toBe(true);
  });

  it('uses the default Prometheus datasource for the OSS summary', async () => {
    setDataSources([
      { uid: 'other-prom', name: 'other-prom' },
      { uid: 'team-prom', name: 'team-prom', isDefault: true },
    ]);

    await expect(fetchMetricsOverview()).resolves.toEqual({
      activeSeries: null,
      dataPointsPerMinute: 5160000,
      datasourceUid: 'team-prom',
    });

    expect(mockGetDataSourceInstanceSettings).toHaveBeenCalledWith({ type: 'prometheus' });
    const options = run.mock.calls[0][0] as CapturedRun;
    expect(options.datasource.uid).toBe('team-prom');
    expect(Object.fromEntries(options.queries.map((query) => [query.refId, query.expr]))).toEqual({
      activeSeries: 'sum(prometheus_tsdb_head_series)',
      dataPointsPerMinute: '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))',
    });
  });

  it('uses active series and its history when the selected OSS datasource exposes self metrics', async () => {
    setDataSources([{ uid: 'team-prom', name: 'team-prom', isDefault: true }]);
    ossActiveSeries = 4200000;

    await expect(fetchMetricsOverview()).resolves.toEqual({
      activeSeries: 4200000,
      activeSeriesSource: 'oss',
      dataPointsPerMinute: 5160000,
      datasourceUid: 'team-prom',
    });
  });

  it('uses the first eligible Prometheus datasource for the OSS summary when no default is configured', async () => {
    setDataSources([
      { uid: 'first-prom', name: 'first-prom' },
      { uid: 'second-prom', name: 'second-prom' },
    ]);

    await expect(fetchMetricsOverview()).resolves.toEqual(expect.objectContaining({ datasourceUid: 'first-prom' }));
  });

  it('falls back when the Cloud usage datasource has no active-series summary', async () => {
    setDataSources([
      { uid: 'usage-uid', name: 'grafanacloud-usage' },
      { uid: 'team-prom', name: 'team-prom', isDefault: true },
    ]);
    instantValues.activeSeries = undefined;

    const overview = await fetchMetricsOverview();

    expect(overview).toEqual({
      activeSeries: null,
      dataPointsPerMinute: 5160000,
      datasourceUid: 'team-prom',
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('returns no summary when the OSS self metrics are unavailable', async () => {
    setDataSources([{ uid: 'team-prom', name: 'team-prom', isDefault: true }]);
    instantValues.dataPointsPerMinute = undefined;

    await expect(fetchMetricsOverview()).resolves.toBeNull();
  });

  it('returns a 24-hour active-series sparkline', async () => {
    setDataSources([{ uid: 'usage-uid', name: 'grafanacloud-usage' }]);

    const history = await fetchMetricsHistory({
      activeSeries: 4200000,
      dataPointsPerMinute: 5160000,
    });

    expect(history?.kind).toBe('activeSeries');
    expect(history?.series.y.values).toEqual([100, 110, 120]);
    const options = run.mock.calls[0][0] as CapturedRun;
    expect(options.datasource.uid).toBe('usage-uid');
    expect(options.queries).toEqual([
      expect.objectContaining({
        refId: 'activeSeries',
        expr: 'sum(grafanacloud_instance_active_series)',
        instant: false,
        range: true,
      }),
    ]);
  });

  it('returns a 24-hour sample-rate sparkline for an OSS summary', async () => {
    const overview: MetricsOverview = {
      activeSeries: null,
      dataPointsPerMinute: 41940,
      datasourceUid: 'team-prom',
    };

    const history = await fetchMetricsHistory(overview);

    expect(history?.kind).toBe('dataPointsPerMinute');
    expect(history?.series.y.values).toEqual([100, 110, 120]);
    const options = run.mock.calls[0][0] as CapturedRun;
    expect(options.datasource.uid).toBe('team-prom');
    expect(options.timeRange.raw.from).toBe('now-24h');
    expect(options.queries).toEqual([
      expect.objectContaining({
        refId: 'dataPointsPerMinute',
        expr: '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))',
        instant: false,
        range: true,
      }),
    ]);
  });

  it('returns a 24-hour active-series sparkline for an OSS summary', async () => {
    const overview: MetricsOverview = {
      activeSeries: 4200000,
      activeSeriesSource: 'oss',
      dataPointsPerMinute: 41940,
      datasourceUid: 'team-prom',
    };

    const history = await fetchMetricsHistory(overview);

    expect(history?.kind).toBe('activeSeries');
    const options = run.mock.calls[0][0] as CapturedRun;
    expect(options.datasource.uid).toBe('team-prom');
    expect(options.queries).toEqual([
      expect.objectContaining({
        refId: 'activeSeries',
        expr: 'sum(prometheus_tsdb_head_series)',
        instant: false,
        range: true,
      }),
    ]);
  });

  it('returns no OSS history when the sample-rate metric was unavailable', async () => {
    const overview: MetricsOverview = {
      activeSeries: null,
      dataPointsPerMinute: null,
      datasourceUid: 'team-prom',
    };

    await expect(fetchMetricsHistory(overview)).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
});
