import { createDataFrame, type DataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import {
  fetchAppObservabilityRequestSeries,
  fetchAppObservabilityStats,
  probeSpanMetrics,
} from './appObservabilityData';
import { runInstantQueries, runRangeQuery } from './promQuery';
import { probeFound } from './solutionDataProbes';
import { backendInstance } from './test-utils';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

jest.mock('./promQuery', () => ({
  ...jest.requireActual('./promQuery'),
  runInstantQueries: jest.fn(),
  runRangeQuery: jest.fn(),
}));

jest.mock('./solutionDataProbes', () => ({
  ...jest.requireActual('./solutionDataProbes'),
  probeFound: jest.fn(),
}));

const runInstantQueriesMock = jest.mocked(runInstantQueries);
const runRangeQueryMock = jest.mocked(runRangeQuery);
const probeFoundMock = jest.mocked(probeFound);
const getInstanceMock = jest.mocked(getDataSourceInstance);

// Frozen literals: drift in the emitted PromQL must be a deliberate contract change.
const SPAN_METRICS_SELECTOR =
  '{__name__=~"traces_spanmetrics_calls_total|traces_span_metrics_calls_total|calls_total",span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"}';
const SERVICES_QUERY =
  'count(count by (job) ({__name__=~"traces_spanmetrics_calls_total|traces_span_metrics_calls_total|calls_total",span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)",job=~".+"}))';
const ERROR_RATIO_QUERY =
  '(sum(label_replace(rate(traces_spanmetrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",status_code="STATUS_CODE_ERROR"}[1h]), "__family__", "0", "", "") or label_replace(rate(traces_span_metrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",status_code="STATUS_CODE_ERROR"}[1h]), "__family__", "1", "", "") or label_replace(rate(calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",status_code="STATUS_CODE_ERROR"}[1h]), "__family__", "2", "", "")) or vector(0)) / sum(label_replace(rate(traces_spanmetrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[1h]), "__family__", "0", "", "") or label_replace(rate(traces_span_metrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[1h]), "__family__", "1", "", "") or label_replace(rate(calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[1h]), "__family__", "2", "", ""))';
const REQUEST_RATE_QUERY =
  'sum(label_replace(rate(traces_spanmetrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[5m]), "__family__", "0", "", "") or label_replace(rate(traces_span_metrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[5m]), "__family__", "1", "", "") or label_replace(rate(calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[5m]), "__family__", "2", "", ""))';

const listItem: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  isDefault: true,
};

const datasource = { uid: 'prom-uid', type: 'prometheus' };

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values }] });
}

beforeEach(() => {
  runInstantQueriesMock.mockReset();
  runRangeQueryMock.mockReset();
  getInstanceMock.mockReset();
  probeFoundMock.mockReset();
  probeFoundMock.mockImplementation(async (_type, hasData) =>
    (await hasData(listItem, new AbortController().signal)) ? listItem : null
  );
});

describe('probeSpanMetrics', () => {
  const getResource = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-24T12:00:00Z'));
    getResource.mockReset();
    getInstanceMock.mockResolvedValue(backendInstance(getResource));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the Prometheus datasource whose series index lists a span-metrics name', async () => {
    getResource.mockResolvedValue({ data: ['traces_spanmetrics_calls_total'] });

    await expect(probeSpanMetrics()).resolves.toBe(listItem);

    const end = Math.floor(Date.now() / 1000);
    expect(getResource).toHaveBeenCalledWith(
      'api/v1/label/__name__/values',
      { start: end - 24 * 3600, end, limit: 1, 'match[]': SPAN_METRICS_SELECTOR },
      { showErrorAlert: false, abortSignal: expect.any(AbortSignal) }
    );
  });

  it('returns null when the index has no span-metrics series', async () => {
    getResource.mockResolvedValue({ data: [] });

    await expect(probeSpanMetrics()).resolves.toBeNull();
  });

  it('only trusts span-metrics names, so a server that ignores match[] cannot fake a hit', async () => {
    getResource.mockResolvedValue({ data: ['up', 'node_cpu_seconds_total'] });
    await expect(probeSpanMetrics()).resolves.toBeNull();

    getResource.mockResolvedValue({ data: ['up', 'calls_total'] });
    await expect(probeSpanMetrics()).resolves.toBe(listItem);
  });
});

describe('fetchAppObservabilityStats', () => {
  it('reads the service count and error ratio off their refIds', async () => {
    runInstantQueriesMock.mockResolvedValue([numberFrame('services', [12]), numberFrame('errorRatio', [0.004])]);

    await expect(fetchAppObservabilityStats(datasource)).resolves.toEqual({ services: 12, errorRatio: 0.004 });
  });

  it('issues the pinned three-naming queries as one partial-tolerant batch', async () => {
    runInstantQueriesMock.mockResolvedValue([]);

    await fetchAppObservabilityStats(datasource);
    expect(runInstantQueriesMock).toHaveBeenCalledWith(
      { services: SERVICES_QUERY, errorRatio: ERROR_RATIO_QUERY },
      datasource,
      { partial: true }
    );
  });

  it('reads absent refIds as null', async () => {
    runInstantQueriesMock.mockResolvedValue([]);

    await expect(fetchAppObservabilityStats(datasource)).resolves.toEqual({ services: null, errorRatio: null });
  });

  it('preserves a numeric zero error ratio instead of reading it as absent', async () => {
    runInstantQueriesMock.mockResolvedValue([numberFrame('services', [5]), numberFrame('errorRatio', [0])]);

    await expect(fetchAppObservabilityStats(datasource)).resolves.toEqual({ services: 5, errorRatio: 0 });
  });
});

describe('fetchAppObservabilityRequestSeries', () => {
  it('issues the fixed-window server-side request-rate range query', async () => {
    runRangeQueryMock.mockResolvedValue([
      createDataFrame({
        refId: 'requests',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2] },
          { name: 'Value', type: FieldType.number, values: [3, 4] },
        ],
      }),
    ]);

    const series = await fetchAppObservabilityRequestSeries(datasource);

    expect(series?.x?.values).toEqual([1, 2]);
    expect(series?.y.values).toEqual([3, 4]);
    expect(runRangeQueryMock).toHaveBeenCalledWith('requests', REQUEST_RATE_QUERY, 24, datasource);
  });

  it('returns null when the span metrics are absent', async () => {
    runRangeQueryMock.mockResolvedValue([]);

    await expect(fetchAppObservabilityRequestSeries(datasource)).resolves.toBeNull();
  });
});
