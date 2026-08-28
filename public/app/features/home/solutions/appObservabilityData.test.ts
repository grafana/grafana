import { createDataFrame, type DataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';

import {
  fetchAppObservabilityRequestSeries,
  fetchAppObservabilityStats,
  probeSpanMetrics,
} from './appObservabilityData';
import { runInstantQueries, runRangeQuery } from './promQuery';
import { probeFound } from './solutionDataProbes';

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

// Frozen literals: drift in the emitted PromQL must be a deliberate contract change.
const SERVICES_QUERY =
  'count(count by (job) (label_replace(last_over_time(traces_spanmetrics_calls_total{job=~".+",span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"}[24h]), "__family__", "0", "", "") or label_replace(last_over_time(traces_span_metrics_calls_total{job=~".+",span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"}[24h]), "__family__", "1", "", "") or label_replace(last_over_time(calls_total{job=~".+",span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"}[24h]), "__family__", "2", "", "")))';
const ERROR_RATIO_QUERY =
  '(sum(label_replace(rate(traces_spanmetrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",status_code="STATUS_CODE_ERROR"}[24h]), "__family__", "0", "", "") or label_replace(rate(traces_span_metrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",status_code="STATUS_CODE_ERROR"}[24h]), "__family__", "1", "", "") or label_replace(rate(calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER",status_code="STATUS_CODE_ERROR"}[24h]), "__family__", "2", "", "")) or vector(0)) / sum(label_replace(rate(traces_spanmetrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[24h]), "__family__", "0", "", "") or label_replace(rate(traces_span_metrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[24h]), "__family__", "1", "", "") or label_replace(rate(calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[24h]), "__family__", "2", "", ""))';
const REQUEST_RATE_QUERY =
  'sum(label_replace(rate(traces_spanmetrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[5m]), "__family__", "0", "", "") or label_replace(rate(traces_span_metrics_calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[5m]), "__family__", "1", "", "") or label_replace(rate(calls_total{span_kind=~"SPAN_KIND_SERVER|SPAN_KIND_CONSUMER"}[5m]), "__family__", "2", "", ""))';

const listItem: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

const datasource = { uid: 'prom-uid', type: 'prometheus' };

function numberFrame(refId: string, values: number[]): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values }] });
}

beforeEach(() => {
  runInstantQueriesMock.mockReset();
  runRangeQueryMock.mockReset();
  probeFoundMock.mockReset();
  probeFoundMock.mockImplementation(async (_type, hasData) => ((await hasData(listItem)) ? listItem : null));
});

describe('probeSpanMetrics', () => {
  it('returns the Prometheus datasource whose span-metrics query finds data', async () => {
    runInstantQueriesMock.mockResolvedValue([numberFrame('probe', [3])]);

    await expect(probeSpanMetrics()).resolves.toBe(listItem);
    expect(runInstantQueriesMock).toHaveBeenCalledWith(
      {
        probe:
          'count(last_over_time(traces_spanmetrics_calls_total{span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"}[24h])) or count(last_over_time(traces_span_metrics_calls_total{span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"}[24h])) or count(last_over_time(calls_total{span_kind=~"SPAN_KIND_(CLIENT|PRODUCER|SERVER|CONSUMER)"}[24h]))',
      },
      listItem,
      expect.any(Number)
    );
  });

  it('returns null when no span-metrics series exists', async () => {
    runInstantQueriesMock.mockResolvedValue([]);

    await expect(probeSpanMetrics()).resolves.toBeNull();
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
      undefined,
      true
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
