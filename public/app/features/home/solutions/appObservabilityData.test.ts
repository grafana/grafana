import { createDataFrame, type DataFrame, type DataSourceInstanceListItem, FieldType } from '@grafana/data';

import {
  fetchAppObservabilityRequestSeries,
  fetchAppObservabilityStats,
  probeSpanMetrics,
} from './appObservabilityData';
import { runInstantQueries, runRangeQuery } from './promQuery';
import { probeFound, SPAN_METRICS_PROBE } from './solutionDataProbes';

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

// Frozen query contracts: both emitter namings unioned everywhere, the server-span filter on
// errorRatio and the request rate only, and the `or vector(0)` numerator on errorRatio.
const SERVICES_QUERY =
  'count(count by (service, service_name) (last_over_time(traces_spanmetrics_calls_total[24h]) or last_over_time(traces_span_metrics_calls_total[24h])))';
const ERROR_RATIO_QUERY =
  '(sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[24h]) or rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[24h])) or vector(0)) / sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[24h]) or rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER"}[24h]))';
const REQUEST_RATE_QUERY =
  'sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[5m]) or rate(traces_span_metrics_calls_total{span_kind="SPAN_KIND_SERVER"}[5m]))';

const listItem: DataSourceInstanceListItem = {
  uid: 'prometheus',
  name: 'Prometheus',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

const datasource = { uid: 'prom-uid', type: 'prometheus' };

function numberFrame(refId: string, values: number[], labels?: Record<string, string>): DataFrame {
  return createDataFrame({ refId, fields: [{ name: 'Value', type: FieldType.number, values, labels }] });
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
    expect(runInstantQueriesMock).toHaveBeenCalledWith({ probe: SPAN_METRICS_PROBE }, listItem, expect.any(Number));
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

  it('issues the pinned dual-naming queries as one partial-tolerant batch', async () => {
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

  it('reads a zero error ratio as zero, whichever metric family produced the frames', async () => {
    // Readers are refId-based: a traces_span_metrics_* (service_name-labeled) response reads
    // the same as the spanmetrics-connector naming.
    runInstantQueriesMock.mockResolvedValue([
      numberFrame('services', [5], { service_name: 'checkout' }),
      numberFrame('errorRatio', [0]),
    ]);

    await expect(fetchAppObservabilityStats(datasource)).resolves.toEqual({ services: 5, errorRatio: 0 });
  });
});

describe('fetchAppObservabilityRequestSeries', () => {
  it('issues the fixed-window server-span request-rate range query', async () => {
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
