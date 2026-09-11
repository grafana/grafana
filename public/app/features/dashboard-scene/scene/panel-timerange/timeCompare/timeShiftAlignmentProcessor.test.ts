import { lastValueFrom } from 'rxjs';

import { dateTime, FieldType, toDataFrame, type DataFrame, type PanelData, type TimeRange } from '@grafana/data';
import { getCompareSeriesRefId, timeShiftAlignmentProcessor } from '@grafana/scenes';
import { LoadingState } from '@grafana/schema';

// getCompareSeriesRefId and the processor now live in @grafana/scenes (core's private fork was
// deleted); these tests stay as contract tests guarding the dependency against a regression to the
// old mutate-in-place behavior.

function makeTimeRange(fromIso: string, toIso: string): TimeRange {
  const from = dateTime(fromIso);
  const to = dateTime(toIso);
  return { from, to, raw: { from, to } };
}

function makePanelData(timeRange: TimeRange, series: DataFrame[] = []): PanelData {
  return { state: LoadingState.Done, series, timeRange };
}

describe('getCompareSeriesRefId', () => {
  const testCases = [
    { name: 'should append -compare to a simple refId', input: 'A', expected: 'A-compare' },
    { name: 'should append -compare to an empty refId', input: '', expected: '-compare' },
    { name: 'should append -compare to a multi-character refId', input: 'Query1', expected: 'Query1-compare' },
    { name: 'should not double-suffix an already-compare refId', input: 'A-compare', expected: 'A-compare' },
  ];

  testCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      expect(getCompareSeriesRefId(input)).toBe(expected);
    });
  });
});

describe('timeShiftAlignmentProcessor', () => {
  const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
  const primaryRange = makeTimeRange('2024-01-10T00:00:00.000Z', '2024-01-10T01:00:00.000Z');
  const secondaryRange = makeTimeRange('2024-01-09T00:00:00.000Z', '2024-01-09T01:00:00.000Z');
  // Secondary is 1 day before primary, so (secondary.from - primary.from) is negative.
  const expectedDiffMs = -MILLISECONDS_PER_DAY;

  it('should not mutate the secondary PanelData, its series, or their frame objects', async () => {
    // The frames here may be owned by a datasource's streaming/split-chunk response accumulator and
    // re-processed on every chunk - mutating them in place caused duplicate compare series to
    // accumulate instead of being replaced. The processor must return new objects instead.
    const frame = toDataFrame({ refId: 'A', fields: [] });
    const secondary = makePanelData(secondaryRange, [frame]);
    const primary = makePanelData(primaryRange);

    const result = await lastValueFrom(timeShiftAlignmentProcessor(primary, secondary));

    expect(result).not.toBe(secondary);
    expect(secondary.series).toEqual([frame]);
    expect(frame.refId).toBe('A');
    expect(frame.meta).toBeUndefined();
  });

  it('should not accumulate duplicate compare series when re-processing the same shared input frame', async () => {
    // Simulates the split-query accumulator pattern: the same frame object is passed through the
    // processor repeatedly (e.g. once per streamed chunk). Each pass must produce exactly one
    // compare series, never more.
    const sharedFrame = toDataFrame({ refId: 'A', fields: [] });
    const secondary = makePanelData(secondaryRange, [sharedFrame]);
    const primary = makePanelData(primaryRange);

    await lastValueFrom(timeShiftAlignmentProcessor(primary, secondary));
    await lastValueFrom(timeShiftAlignmentProcessor(primary, secondary));
    const result = await lastValueFrom(timeShiftAlignmentProcessor(primary, secondary));

    expect(sharedFrame.refId).toBe('A');
    expect(result.series).toHaveLength(1);
    expect(result.series[0].refId).toBe('A-compare');
  });

  it('should append -compare to each series refId', async () => {
    const secondary = makePanelData(secondaryRange, [
      toDataFrame({ refId: 'A', fields: [] }),
      toDataFrame({ refId: 'B', fields: [] }),
    ]);

    const result = await lastValueFrom(timeShiftAlignmentProcessor(makePanelData(primaryRange), secondary));

    expect(result.series.map((s) => s.refId)).toEqual(['A-compare', 'B-compare']);
  });

  it('should not double-suffix series that already have a compare refId', async () => {
    // Compare requests now use A-compare; datasources echo that back on the response.
    const secondary = makePanelData(secondaryRange, [toDataFrame({ refId: 'A-compare', fields: [] })]);

    const result = await lastValueFrom(timeShiftAlignmentProcessor(makePanelData(primaryRange), secondary));

    expect(result.series[0].refId).toBe('A-compare');
  });

  it('should attach timeCompare metadata with the signed diff between secondary and primary', async () => {
    const secondary = makePanelData(secondaryRange, [toDataFrame({ refId: 'A', fields: [] })]);

    const result = await lastValueFrom(timeShiftAlignmentProcessor(makePanelData(primaryRange), secondary));

    expect(result.series[0].meta?.timeCompare).toEqual({
      diffMs: expectedDiffMs,
      isTimeShiftQuery: true,
    });
  });

  it('should preserve existing meta fields when adding timeCompare', async () => {
    // The processor spread-merges onto existing meta ({ ...series.meta, timeCompare }), so prior fields must survive.
    const frame = toDataFrame({
      refId: 'A',
      fields: [{ name: 'time', type: FieldType.time, values: [] }],
    });
    frame.meta = { custom: { keep: true } };
    const secondary = makePanelData(secondaryRange, [frame]);

    const result = await lastValueFrom(timeShiftAlignmentProcessor(makePanelData(primaryRange), secondary));

    expect(result.series[0].meta?.custom).toEqual({ keep: true });
  });

  it('should handle a series with no refId by producing -compare', async () => {
    // Exercises the `series.refId || ''` fallback in the source — avoids an "undefined-compare" result.
    const secondary = makePanelData(secondaryRange, [toDataFrame({ fields: [] })]);

    const result = await lastValueFrom(timeShiftAlignmentProcessor(makePanelData(primaryRange), secondary));

    expect(result.series[0].refId).toBe('-compare');
  });
});
