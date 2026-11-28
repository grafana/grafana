import { type DataSourceInstanceSettings } from '@grafana/data';
import { type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

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

describe('createTraceLogsLink time shift', () => {
  it('treats a unit-less 0 time shift as no shift', () => {
    const rootSpan = {
      spanID: 'span1',
      traceID: 'trace1',
      processID: 'p1',
      operationName: 'checkout',
      logs: [],
      startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
      duration: 1000 * 1000,
      flags: 0,
      hasChildren: false,
      dataFrameRowIndex: 0,
      tags: [],
      process: { serviceName: 'checkout', tags: [{ key: 'service.namespace', value: 'shop' }] },
    } as unknown as TraceSpan;

    const link = createTraceLogsLink({
      splitOpenFn: jest.fn(),
      traceToLogsOptions: {
        customQuery: false,
        datasourceUid: 'loki-uid',
        spanStartTimeShift: '0',
        spanEndTimeShift: '0',
      },
      trace: {
        traceID: 'trace1',
        traceName: 'checkout',
        startTime: rootSpan.startTime,
        duration: rootSpan.duration,
        spans: [rootSpan],
        processes: { p1: rootSpan.process },
      } as unknown as Trace,
      logsDataSourceSettings: { uid: 'loki-uid', name: 'Loki', type: 'loki' } as unknown as DataSourceInstanceSettings,
    });

    const left = JSON.parse(new URLSearchParams(link!.href.split('?')[1]).get('left')!);
    expect(left.range).toEqual({ from: '1602637200000', to: '1602637201000' });
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

describe('createTraceLogsLink across services', () => {
  const createServiceSpan = (spanID: string, serviceName: string, parentSpanID?: string) =>
    ({
      spanID,
      traceID: 'trace1',
      processID: spanID,
      operationName: 'operation',
      logs: [],
      startTime: 1_000_000,
      duration: 1000,
      flags: 0,
      hasChildren: false,
      dataFrameRowIndex: 0,
      tags: [],
      references: parentSpanID ? [{ refType: 'CHILD_OF', traceID: 'trace1', spanID: parentSpanID }] : [],
      process: {
        serviceName,
        tags: [
          { key: 'service.name', value: serviceName },
          { key: 'service.namespace', value: 'shop' },
        ],
      },
    }) as unknown as TraceSpan;
  const spans = [
    createServiceSpan('root', 'load-generator'),
    createServiceSpan('order', 'checkout', 'root'),
    createServiceSpan('quote', 'quote.v2', 'order'),
  ];
  const trace = {
    traceID: 'trace1',
    traceName: 'checkout',
    duration: 1000,
    startTime: 1_000_000,
    spans,
    processes: {},
  } as unknown as Trace;
  const selector = String.raw`{service_name=~"load-generator|checkout|quote\\.v2", service_namespace="shop"}`;
  const createLink = (traceToLogsOptions: Partial<TraceToLogsOptionsV2>) =>
    createTraceLogsLink({
      splitOpenFn: jest.fn(),
      traceToLogsOptions: { datasourceUid: 'loki-uid', customQuery: false, ...traceToLogsOptions },
      trace,
      logsDataSourceSettings: {
        uid: 'loki-uid',
        name: 'Loki',
        type: 'loki',
        jsonData: {},
      } as unknown as DataSourceInstanceSettings,
    });
  const getExploreQuery = (href: string) =>
    JSON.parse(new URLSearchParams(href.split('?')[1]).get('left')!).queries[0].expr;

  afterEach(() => {
    setTestFlags({});
  });

  it('probes logs of every service in the trace first', () => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: true });

    const link = createLink({});
    const expected = `${selector} | logfmt | json | drop __error__ | trace_id="trace1"`;

    expect(link?.interpolatedParams?.alternativeQueries?.[0]).toEqual(
      expect.objectContaining({ expr: expected, refId: 't2l:default:trace_id' })
    );
    expect(getExploreQuery(link!.href)).toBe(expected);
  });

  it('interpolates the combined tags into the legacy query', () => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: false });

    const link = createLink({ filterByTraceID: true });

    expect(getExploreQuery(link!.href)).toBe(
      `${selector} | label_format log_line_contains_trace_id=\`{{ contains "trace1" __line__  }}\` | log_line_contains_trace_id="true" or trace_id="trace1"`
    );
  });

  it('interpolates the combined tags into a custom query', () => {
    const link = createLink({ customQuery: true, query: '{${__tags}} |= "${__trace.traceId}"' });

    expect(getExploreQuery(link!.href)).toBe(`${selector} |= "trace1"`);
  });
});
