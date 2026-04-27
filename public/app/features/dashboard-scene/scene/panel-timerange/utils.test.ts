import { lastValueFrom } from 'rxjs';

import { FieldType, toDataFrame, type DataFrame } from '@grafana/data/dataframe';
import { dateTime } from '@grafana/data/datetime';
import type { PanelData, TimeRange } from '@grafana/data/types';
import { LoadingState } from '@grafana/schema';

import { getCompareSeriesRefId, getCompareTimeRange, timeShiftAlignmentProcessor } from './utils';

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

    it('should populate raw to match the shifted range', () => {
      // raw.from/to are typed `string | DateTime`; dateTime() normalizes either for ISO comparison.
      const result = getCompareTimeRange(baseRange, '1d')!;

      expect(dateTime(result.raw.from).toISOString()).toBe('2024-01-09T06:00:00.000Z');
      expect(dateTime(result.raw.to).toISOString()).toBe('2024-01-09T12:00:00.000Z');
    });
  });

  describe('timeShiftAlignmentProcessor', () => {
    const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
    const primaryRange = makeTimeRange('2024-01-10T00:00:00.000Z', '2024-01-10T01:00:00.000Z');
    const secondaryRange = makeTimeRange('2024-01-09T00:00:00.000Z', '2024-01-09T01:00:00.000Z');
    // Secondary is 1 day before primary, so (secondary.from - primary.from) is negative.
    const expectedDiffMs = -MILLISECONDS_PER_DAY;

    it('should emit the secondary PanelData', async () => {
      // The processor mutates secondary in place and re-emits the same reference; downstream code relies on that.
      const secondary = makePanelData(secondaryRange, [toDataFrame({ refId: 'A', fields: [] })]);
      const primary = makePanelData(primaryRange);

      const result = await lastValueFrom(timeShiftAlignmentProcessor(primary, secondary));

      expect(result).toBe(secondary);
    });

    it('should append -compare to each series refId', async () => {
      const secondary = makePanelData(secondaryRange, [
        toDataFrame({ refId: 'A', fields: [] }),
        toDataFrame({ refId: 'B', fields: [] }),
      ]);

      const result = await lastValueFrom(timeShiftAlignmentProcessor(makePanelData(primaryRange), secondary));

      expect(result.series.map((s) => s.refId)).toEqual(['A-compare', 'B-compare']);
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
