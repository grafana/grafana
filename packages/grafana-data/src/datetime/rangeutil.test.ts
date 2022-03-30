import { TimeRange } from '../types/time';
import { dateTime, rangeUtil } from './index';
import { timeRangeToRelative } from './rangeutil';

describe('Range Utils', () => {
  describe('relative time', () => {
    it('should identify absolute vs relative', () => {
      expect(
        rangeUtil.isRelativeTimeRange({
          from: '1234',
          to: '4567',
        })
      ).toBe(false);
      expect(
        rangeUtil.isRelativeTimeRange({
          from: 'now-5',
          to: 'now',
        })
      ).toBe(true);
    });
  });

  describe('describe_interval', () => {
    it('falls back to seconds if input is a number', () => {
      expect(rangeUtil.describeInterval('123')).toEqual({
        sec: 1,
        type: 's',
        count: 123,
      });
    });

    it('parses a valid time unt string correctly', () => {
      expect(rangeUtil.describeInterval('123h')).toEqual({
        sec: 3600,
        type: 'h',
        count: 123,
      });
    });

    it('fails if input is invalid', () => {
      expect(() => rangeUtil.describeInterval('123xyz')).toThrow();
      expect(() => rangeUtil.describeInterval('xyz')).toThrow();
    });

    it('should be able to parse negative values as well', () => {
      expect(rangeUtil.describeInterval('-50ms')).toEqual({
        sec: 0.001,
        type: 'ms',
        count: -50,
      });
    });
  });

  describe('relativeToTimeRange', () => {
    it('should convert seconds to timeRange', () => {
      const relativeTimeRange = { from: 600, to: 300 };
      const timeRange = rangeUtil.relativeToTimeRange(relativeTimeRange, dateTime('2021-04-20T15:55:00Z'));

      expect(timeRange.from.valueOf()).toEqual(dateTime('2021-04-20T15:45:00Z').valueOf());
      expect(timeRange.to.valueOf()).toEqual(dateTime('2021-04-20T15:50:00Z').valueOf());
    });

    it('should convert from now', () => {
      const relativeTimeRange = { from: 600, to: 0 };
      const timeRange = rangeUtil.relativeToTimeRange(relativeTimeRange, dateTime('2021-04-20T15:55:00Z'));

      expect(timeRange.from.valueOf()).toEqual(dateTime('2021-04-20T15:45:00Z').valueOf());
      expect(timeRange.to.valueOf()).toEqual(dateTime('2021-04-20T15:55:00Z').valueOf());
    });
  });

  describe('timeRangeToRelative', () => {
    it('should convert now-15m to relaitve time range', () => {
      const now = dateTime('2021-04-20T15:55:00Z');
      const timeRange: TimeRange = {
        from: dateTime(now).subtract(15, 'minutes'),
        to: now,
        raw: {
          from: 'now-15m',
          to: 'now',
        },
      };

      const relativeTimeRange = timeRangeToRelative(timeRange, now);

      expect(relativeTimeRange.from).toEqual(900);
      expect(relativeTimeRange.to).toEqual(0);
    });

    it('should convert now-2w, now-1w to relative range', () => {
      const now = dateTime('2021-04-20T15:55:00Z');
      const timeRange: TimeRange = {
        from: dateTime(now).subtract(2, 'weeks'),
        to: dateTime(now).subtract(1, 'week'),
        raw: {
          from: 'now-2w',
          to: 'now-1w',
        },
      };

      const relativeTimeRange = timeRangeToRelative(timeRange, now);

      expect(relativeTimeRange.from).toEqual(1209600);
      expect(relativeTimeRange.to).toEqual(604800);
    });
  });
});
