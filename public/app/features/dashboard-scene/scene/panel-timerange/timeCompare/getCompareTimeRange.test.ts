import { dateTime, type TimeRange } from '@grafana/data';

import { getCompareTimeRange } from './getCompareTimeRange';

function makeTimeRange(fromIso: string, toIso: string): TimeRange {
  const from = dateTime(fromIso);
  const to = dateTime(toIso);
  return { from, to, raw: { from, to } };
}

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
