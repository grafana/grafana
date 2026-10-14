import { type DataSourceInstanceSettings } from '@grafana/data';

import { type Trace, type TraceSpan } from './components/types/trace';
import { createTraceLogsLink, getTimeRangeFromTimestamps } from './createTraceLink';

describe('getTimeRangeFromTimestamps', () => {
  const startTimeUs = 1_000_000;

  it('leaves a valid window unchanged', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 5_000_000);

    expect(range.from.valueOf()).toBe(1000);
    expect(range.to.valueOf()).toBe(6000);
  });

  it('expands a zero-width window by 1ms', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 0);

    expect(range.from.valueOf()).toBe(1000);
    expect(range.to.valueOf()).toBe(1001);
  });

  it('clamps an inverted window so to is 1ms after from', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 1_000, { startMs: 5_000, endMs: 0 });

    expect(range.from.valueOf()).toBe(6000);
    expect(range.to.valueOf()).toBe(6001);
  });

  it('clamps a window inverted by a negative end shift', () => {
    const range = getTimeRangeFromTimestamps(startTimeUs, 1_000, { startMs: 0, endMs: -5_000 });

    expect(range.from.valueOf()).toBe(1000);
    expect(range.to.valueOf()).toBe(1001);
  });

  it('expands a short or inverted Splunk window to 1s', () => {
    const equal = getTimeRangeFromTimestamps(startTimeUs, 0, { startMs: 0, endMs: 0 }, true);
    expect(equal.from.valueOf()).toBe(1000);
    expect(equal.to.valueOf()).toBe(2000);

    const inverted = getTimeRangeFromTimestamps(startTimeUs, 1_000, { startMs: 5_000, endMs: 0 }, true);
    expect(inverted.from.valueOf()).toBe(6000);
    expect(inverted.to.valueOf()).toBe(7000);
  });
});

describe('createTraceLogsLink data source type', () => {
  const rootSpan = {
    spanID: 'span1',
    traceID: 'trace1',
    processID: 'p1',
    operationName: 'checkout',
    logs: [],
    startTime: 1_000_000,
    duration: 1000,
    flags: 0,
    hasChildren: false,
    dataFrameRowIndex: 0,
    tags: [],
    process: { serviceName: 'checkout', tags: [{ key: 'service.namespace', value: 'shop' }] },
  } as unknown as TraceSpan;
  const trace = {
    traceID: 'trace1',
    traceName: 'checkout',
    duration: 1000,
    startTime: 1_000_000,
    endTime: 1_001_000,
    spans: [rootSpan],
    processes: { p1: rootSpan.process },
  } as unknown as Trace;
  const createLink = (traceToLogsOptions: { customQuery: boolean; query?: string }) =>
    createTraceLogsLink({
      splitOpenFn: jest.fn(),
      traceToLogsOptions: { datasourceUid: 'loki-uid', filterByTraceID: true, ...traceToLogsOptions },
      trace,
      logsDataSourceSettings: {
        uid: 'loki-uid',
        name: 'Loki',
        type: 'loki',
        jsonData: {},
      } as unknown as DataSourceInstanceSettings,
    });

  // Logs Drilldown only links to targets typed as loki. LogsLink probes alternativeQueries when they are set, and a
  // custom query is a one-element array, so the type has to be on the alternative query as well.
  it('types a custom query and its alternative query with the logs data source', () => {
    const link = createLink({ customQuery: true, query: '{job="app"} |= "${__trace.traceId}"' });

    const expected = {
      expr: '{job="app"} |= "trace1"',
      refId: 't2l:custom',
      datasource: { type: 'loki', uid: 'loki-uid' },
    };
    expect(link?.interpolatedParams?.query).toEqual(expected);
    expect(link?.interpolatedParams?.alternativeQueries).toEqual([expected]);
  });

  it('types a generated query with the logs data source', () => {
    const link = createLink({ customQuery: false });

    expect(link?.interpolatedParams?.query?.datasource).toEqual({ type: 'loki', uid: 'loki-uid' });
  });
});
