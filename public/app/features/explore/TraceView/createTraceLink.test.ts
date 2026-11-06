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
