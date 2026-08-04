import { lastValueFrom } from 'rxjs';

import { dateTime, FieldType, toDataFrame, type DataFrame, type PanelData, type TimeRange } from '@grafana/data';
import { getCompareSeriesRefId, timeShiftAlignmentProcessor } from '@grafana/scenes';
import { LoadingState } from '@grafana/schema';

// The processor now lives in @grafana/scenes (core's private fork was deleted); these tests stay
// as contract tests guarding the dependency against a regression to the old mutate-in-place behavior.

import { getCompareTimeRange } from './utils';

function makeTimeRange(fromIso: string, toIso: string): TimeRange {
  const from = dateTime(fromIso);
  const to = dateTime(toIso);
  return { from, to, raw: { from, to } };
}

function makePanelData(timeRange: TimeRange, series: DataFrame[] = []): PanelData {
  return { state: LoadingState.Done, series, timeRange };
}

describe('panel-timerange/utils', () => {
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

  describe('getCompareTimeRange', () => {
    // 6-hour span so __previousPeriod shifts (by range duration) differ from the fixed intervals below.
    const baseRange = makeTimeRange('2024-01-10T06:00:00.000Z', '2024-01-10T12:00:00.000Z');

    it('should return undefined when compareWith is undefined', () => {
      expect(getCompareTimeRange(baseRange, undefined)).toBeUndefined();
    });

    it('should return undefined when compareWith is an empty string', () => {
      expect(getCompareTimeRange(baseRange, '')).toBeUndefined();
    });

    it('should shift by the range duration when compareWith is __previousPeriod', () => {
      // The __previousPeriod sentinel shifts by (to - from) rather than a fixed interval.
      const result = getCompareTimeRange(baseRange, '__previousPeriod')!;

      expect(result.from.toISOString()).toBe('2024-01-10T00:00:00.000Z');
      expect(result.to.toISOString()).toBe('2024-01-10T06:00:00.000Z');
    });

    // Interval strings are parsed via rangeUtil.intervalToMs, then subtracted from both ends of the range.
    it.each([
      ['should shift by 1 day when compareWith is 1d', '1d', '2024-01-09T06:00:00.000Z', '2024-01-09T12:00:00.000Z'],
      ['should shift by 1 week when compareWith is 1w', '1w', '2024-01-03T06:00:00.000Z', '2024-01-03T12:00:00.000Z'],
      ['should shift by 2 hours when compareWith is 2h', '2h', '2024-01-10T04:00:00.000Z', '2024-01-10T10:00:00.000Z'],
    ])('%s', (_, compareWith, expectedFrom, expectedTo) => {
      const result = getCompareTimeRange(baseRange, compareWith)!;
      expect(result.from.toISOString()).toBe(expectedFrom);
      expect(result.to.toISOString()).toBe(expectedTo);
    });

    it('should populate raw to match the shifted range for absolute ranges', () => {
      // raw.from/to are typed `string | DateTime`; dateTime() normalizes either for ISO comparison.
      const result = getCompareTimeRange(baseRange, '1d')!;

      expect(dateTime(result.raw.from).toISOString()).toBe('2024-01-09T06:00:00.000Z');
      expect(dateTime(result.raw.to).toISOString()).toBe('2024-01-09T12:00:00.000Z');
    });

    it('should preserve relative raw strings so compare shifts on refresh', () => {
      const relativeRange: TimeRange = {
        from: dateTime('2024-01-10T06:00:00.000Z'),
        to: dateTime('2024-01-10T12:00:00.000Z'),
        raw: { from: 'now-6h', to: 'now' },
      };

      const result = getCompareTimeRange(relativeRange, '1d')!;

      expect(result.raw.from).toBe('now-6h-1d');
      expect(result.raw.to).toBe('now-1d');
    });

    it('should preserve relative raw strings for __previousPeriod', () => {
      const relativeRange: TimeRange = {
        from: dateTime('2024-01-10T06:00:00.000Z'),
        to: dateTime('2024-01-10T12:00:00.000Z'),
        raw: { from: 'now-6h', to: 'now' },
      };

      const result = getCompareTimeRange(relativeRange, '__previousPeriod')!;

      expect(result.raw.from).toBe('now-6h-6h');
      expect(result.raw.to).toBe('now-6h');
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
});
