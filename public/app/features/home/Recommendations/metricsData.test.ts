import { of } from 'rxjs';

import { getAPINamespace } from '@grafana/api-clients';
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
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { fetchMetricsHistory, fetchMetricsOverview, type MetricsOverview } from './metricsData';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  createQueryRunner: jest.fn(),
}));

jest.mock('@grafana/api-clients', () => ({
  ...jest.requireActual('@grafana/api-clients'),
  getAPINamespace: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockCreateQueryRunner = jest.mocked(createQueryRunner);
const mockGetDataSourceInstanceList = jest.mocked(getDataSourceInstanceList);
const mockGetAPINamespace = jest.mocked(getAPINamespace);
const run = jest.fn();
const destroy = jest.fn();
const CLOUD_USAGE_DATASOURCE_UID = 'grafanacloud-usage';

function usageQueries(stackId: string): MetricsOverview['queries'] {
  return {
    datasourceUid: CLOUD_USAGE_DATASOURCE_UID,
    activeSeries: `sum(grafanacloud_instance_active_series{stack_id="${stackId}"})`,
    dataPointsPerMinute: `60 * sum(grafanacloud_instance_samples_per_second{stack_id="${stackId}"})`,
  };
}

function prometheusQueries(datasourceUid: string): MetricsOverview['queries'] {
  return {
    datasourceUid,
    activeSeries: 'sum(prometheus_tsdb_head_series)',
    dataPointsPerMinute: '60 * sum(rate(prometheus_tsdb_head_samples_appended_total[5m]))',
  };
}

type CapturedRun = {
  datasource: { uid: string };
  queries: Array<{ refId: string; expr: string; instant: boolean; range: boolean }>;
  timeRange: { raw: { from: string } };
};

const instantValues: Record<string, number | undefined> = {};
let activeSeries: number | undefined;
let usageActiveSeries: number | undefined;
let usageDataPointsPerMinute: number | undefined;

function setDataSources(
  list: Array<{ uid: string; name: string; isDefault?: boolean; type?: string; metaId?: string }>
) {
  const datasources = list.map(
    ({ metaId, ...datasource }) =>
      ({
        ...datasource,
        type: datasource.type ?? 'prometheus',
        meta: { id: metaId ?? 'prometheus' },
        isDefault: datasource.isDefault ?? false,
      }) as DataSourceInstanceListItem
  );
  mockGetDataSourceInstanceList.mockImplementation(async (filters) =>
    datasources.filter((datasource) => filters?.filter?.(datasource) ?? true)
  );
}

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values }] });
}

beforeEach(() => {
  Object.assign(instantValues, { activeSeries: 4200000, dataPointsPerMinute: 5160000 });
  activeSeries = undefined;
  usageActiveSeries = 4200000;
  usageDataPointsPerMinute = 5160000;
  run.mockReset();
  destroy.mockReset();
  mockCreateQueryRunner.mockReset();
  mockGetDataSourceInstanceList.mockReset();
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
                query.refId === 'activeSeries'
                  ? captured?.datasource.uid === CLOUD_USAGE_DATASOURCE_UID
                    ? usageActiveSeries
                    : activeSeries
                  : captured?.datasource.uid === CLOUD_USAGE_DATASOURCE_UID
                    ? usageDataPointsPerMinute
                    : instantValues[query.refId];
              return value === undefined ? [] : [numberFrame(query.refId, [value])];
            });
        return of({ state: LoadingState.Done, series, timeRange: {} } as PanelData);
      },
      cancel: jest.fn(),
      destroy,
    } as unknown as QueryRunner;
  });
  mockGetAPINamespace.mockReturnValue('default');
});

afterEach(() => jest.restoreAllMocks());

describe('Metrics data', () => {
  it('uses stack-scoped usage metrics when the usage datasource is available', async () => {
    mockGetAPINamespace.mockReturnValue('stacks-12345');
    setDataSources([
      { uid: 'team-prom', name: 'team-prom', isDefault: true },
      { uid: CLOUD_USAGE_DATASOURCE_UID, name: 'grafanacloud-usage' },
    ]);

    await expect(fetchMetricsOverview()).resolves.toEqual({
      activeSeries: 4200000,
      dataPointsPerMinute: 5160000,
      queries: usageQueries('12345'),
    });

    const options = run.mock.calls[0][0] as CapturedRun;
    const { datasourceUid, ...expressions } = usageQueries('12345');
    expect(options.datasource.uid).toBe(datasourceUid);
    expect(Object.fromEntries(options.queries.map((query) => [query.refId, query.expr]))).toEqual(expressions);
    expect(options.queries.every((query) => query.instant && !query.range)).toBe(true);
  });

  it('uses the default Prometheus datasource for the metrics summary', async () => {
    setDataSources([
      { uid: 'other-prom', name: 'other-prom' },
      { uid: 'team-prom', name: 'team-prom', isDefault: true },
    ]);
    activeSeries = 4200000;

    await expect(fetchMetricsOverview()).resolves.toEqual({
      activeSeries: 4200000,
      dataPointsPerMinute: 5160000,
      queries: prometheusQueries('team-prom'),
    });

    const options = run.mock.calls[0][0] as CapturedRun;
    const { datasourceUid, ...expressions } = prometheusQueries('team-prom');
    expect(options.datasource.uid).toBe(datasourceUid);
    expect(Object.fromEntries(options.queries.map((query) => [query.refId, query.expr]))).toEqual(expressions);
  });

  it.each(['default', 'stacks-'])(
    'ignores the usage datasource when namespace %s has no stack ID',
    async (namespace) => {
      mockGetAPINamespace.mockReturnValue(namespace);
      setDataSources([
        { uid: CLOUD_USAGE_DATASOURCE_UID, name: 'grafanacloud-usage' },
        { uid: 'team-prom', name: 'team-prom', isDefault: true },
      ]);
      activeSeries = 4200000;

      await expect(fetchMetricsOverview()).resolves.toEqual({
        activeSeries: 4200000,
        dataPointsPerMinute: 5160000,
        queries: prometheusQueries('team-prom'),
      });
    }
  );

  it('does not query the usage datasource as ordinary Prometheus when no stack ID is available', async () => {
    setDataSources([{ uid: CLOUD_USAGE_DATASOURCE_UID, name: 'grafanacloud-usage' }]);

    await expect(fetchMetricsOverview()).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('falls back to the default Prometheus datasource when a Cloud stack has no usage datasource', async () => {
    mockGetAPINamespace.mockReturnValue('stacks-12345');
    setDataSources([
      { uid: 'other-prom', name: 'other-prom' },
      { uid: 'team-prom', name: 'team-prom', isDefault: true },
    ]);
    activeSeries = 4200000;

    await expect(fetchMetricsOverview()).resolves.toEqual({
      activeSeries: 4200000,
      dataPointsPerMinute: 5160000,
      queries: prometheusQueries('team-prom'),
    });
  });

  it('keeps the active-series summary when data points per minute are unavailable', async () => {
    setDataSources([{ uid: 'team-prom', name: 'team-prom', isDefault: true }]);
    activeSeries = 4200000;
    instantValues.dataPointsPerMinute = undefined;

    await expect(fetchMetricsOverview()).resolves.toEqual({
      activeSeries: 4200000,
      dataPointsPerMinute: null,
      queries: prometheusQueries('team-prom'),
    });
  });

  it('uses the first Prometheus datasource when no default is configured', async () => {
    setDataSources([
      { uid: 'first-prom', name: 'first-prom' },
      { uid: 'second-prom', name: 'second-prom' },
    ]);
    activeSeries = 4200000;

    await expect(fetchMetricsOverview()).resolves.toEqual(
      expect.objectContaining({ queries: prometheusQueries('first-prom') })
    );
  });

  it('ignores the built-in Grafana datasource when no Prometheus datasource exists', async () => {
    setDataSources([{ uid: 'grafana', name: '-- Grafana --', type: 'datasource', metaId: 'grafana' }]);

    await expect(fetchMetricsOverview()).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('does not switch to local metrics when the usage datasource is empty', async () => {
    mockGetAPINamespace.mockReturnValue('stacks-12345');
    setDataSources([
      { uid: CLOUD_USAGE_DATASOURCE_UID, name: 'grafanacloud-usage' },
      { uid: 'team-prom', name: 'team-prom', isDefault: true },
    ]);
    usageActiveSeries = undefined;
    usageDataPointsPerMinute = undefined;

    const overview = await fetchMetricsOverview();

    expect(overview).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 0])('returns no summary when active series is %s', async (value) => {
    setDataSources([{ uid: 'team-prom', name: 'team-prom', isDefault: true }]);
    activeSeries = value;

    await expect(fetchMetricsOverview()).resolves.toBeNull();
  });

  it('uses the overview datasource and query for 24-hour active-series history', async () => {
    const overview: MetricsOverview = {
      activeSeries: 4200000,
      dataPointsPerMinute: 41940,
      queries: prometheusQueries('team-prom'),
    };

    const history = await fetchMetricsHistory(overview);

    expect(history?.y.values).toEqual([100, 110, 120]);
    const options = run.mock.calls[0][0] as CapturedRun;
    expect(options.datasource.uid).toBe('team-prom');
    expect(options.timeRange.raw.from).toBe('now-24h');
    expect(options.queries).toEqual([
      expect.objectContaining({
        refId: 'history',
        expr: 'sum(prometheus_tsdb_head_series)',
        instant: false,
        range: true,
      }),
    ]);
  });
});
