import { RawTimeRange, TimeRange } from '../types/time';

import { timeRangeToRelative } from './rangeutil';

import { dateTime, rangeUtil } from './index';

describe('Range Utils', () => {
  // These test probably wraps the dateTimeParser tests to some extent
  describe('convertRawToRange', () => {
    const DEFAULT_DATE_VALUE = '1996-07-30 16:00:00'; // Default format YYYY-MM-DD HH:mm:ss
    const DEFAULT_DATE_VALUE_FORMATTED = '1996-07-30T16:00:00-06:00';
    const defaultRawTimeRange = {
      from: DEFAULT_DATE_VALUE,
      to: '1996-07-30 16:20:00',
    };

    it('should serialize the default format by default', () => {
      const deserialized = rangeUtil.convertRawToRange(defaultRawTimeRange);
      expect(deserialized.from.format()).toBe(DEFAULT_DATE_VALUE_FORMATTED);
    });

    it('should serialize using custom formats', () => {
      const NON_DEFAULT_FORMAT = 'DD-MM-YYYY HH:mm:ss';
      const nonDefaultRawTimeRange: RawTimeRange = {
        from: '30-07-1996 16:00:00',
        to: '30-07-1996 16:20:00',
      };

      const deserializedTimeRange = rangeUtil.convertRawToRange(
        nonDefaultRawTimeRange,
        undefined,
        undefined,
        NON_DEFAULT_FORMAT
      );
      expect(deserializedTimeRange.from.format()).toBe(DEFAULT_DATE_VALUE_FORMATTED);
    });

    it('should take timezone into account', () => {
      const deserializedTimeRange = rangeUtil.convertRawToRange(defaultRawTimeRange, 'UTC');
      expect(deserializedTimeRange.from.format()).toBe('1996-07-30T16:00:00Z');
    });

    it('should leave the raw part intact if it has calulactions', () => {
      const timeRange = {
        from: DEFAULT_DATE_VALUE,
        to: 'now',
      };

      const deserialized = rangeUtil.convertRawToRange(timeRange);
      expect(deserialized.raw).toStrictEqual(timeRange);
      expect(deserialized.to.toString()).not.toBe(deserialized.raw.to);
    });
  });

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

  describe('roundInterval', () => {
    it('rounds 9ms to 1ms', () => {
      expect(rangeUtil.roundInterval(9)).toEqual(1);
    });

    it('rounds 14ms to 10ms', () => {
      expect(rangeUtil.roundInterval(9)).toEqual(1);
    });

    it('rounds 34ms to 20ms', () => {
      expect(rangeUtil.roundInterval(34)).toEqual(20);
    });

    it('rounds 74ms to 50ms', () => {
      expect(rangeUtil.roundInterval(74)).toEqual(50);
    });

    it('rounds 149ms to 100ms', () => {
      expect(rangeUtil.roundInterval(149)).toEqual(100);
    });

    it('rounds 349ms to 200ms', () => {
      expect(rangeUtil.roundInterval(349)).toEqual(200);
    });

    it('rounds 749ms to 500ms', () => {
      expect(rangeUtil.roundInterval(749)).toEqual(500);
    });

    it('rounds 1.5s to 1s', () => {
      expect(rangeUtil.roundInterval(1499)).toEqual(1000);
    });

    it('rounds 3.5s to 2s', () => {
      expect(rangeUtil.roundInterval(3499)).toEqual(2000);
    });

    it('rounds 7.5s to 5s', () => {
      expect(rangeUtil.roundInterval(7499)).toEqual(5000);
    });

    it('rounds 12.5s to 10s', () => {
      expect(rangeUtil.roundInterval(12499)).toEqual(10000);
    });

    it('rounds 17.5s to 15s', () => {
      expect(rangeUtil.roundInterval(17499)).toEqual(15000);
    });

    it('rounds 25s to 20s', () => {
      expect(rangeUtil.roundInterval(24999)).toEqual(20000);
    });

    it('rounds 45s to 30s', () => {
      expect(rangeUtil.roundInterval(44999)).toEqual(30000);
    });

    it('rounds 1m30s to 1m', () => {
      expect(rangeUtil.roundInterval(89999)).toEqual(60000);
    });

    it('rounds 3m30s to 2m', () => {
      expect(rangeUtil.roundInterval(209999)).toEqual(120000);
    });

    it('rounds 7m30s to 5m', () => {
      expect(rangeUtil.roundInterval(449999)).toEqual(300000);
    });

    it('rounds 12m30s to 10m', () => {
      expect(rangeUtil.roundInterval(749999)).toEqual(600000);
    });

    it('rounds 17m30s to 15m', () => {
      expect(rangeUtil.roundInterval(1049999)).toEqual(900000);
    });

    it('rounds 25m to 20m', () => {
      expect(rangeUtil.roundInterval(1499999)).toEqual(1200000);
    });

    it('rounds 45m to 30m', () => {
      expect(rangeUtil.roundInterval(2699999)).toEqual(1800000);
    });

    it('rounds 1h30m to 1h', () => {
      expect(rangeUtil.roundInterval(5399999)).toEqual(3600000);
    });

    it('rounds 2h30m to 2h', () => {
      expect(rangeUtil.roundInterval(8999999)).toEqual(7200000);
    });

    it('rounds 4h30m to 3h', () => {
      expect(rangeUtil.roundInterval(16199999)).toEqual(10800000);
    });

    it('rounds 9h to 6h', () => {
      expect(rangeUtil.roundInterval(32399999)).toEqual(21600000);
    });

    it('rounds 1d to 12h', () => {
      expect(rangeUtil.roundInterval(86399999)).toEqual(43200000);
    });

    it('rounds 1w to 1d', () => {
      expect(rangeUtil.roundInterval(604799999)).toEqual(86400000);
    });

    it('rounds 3w to 1w', () => {
      expect(rangeUtil.roundInterval(1814399999)).toEqual(604800000);
    });

    it('rounds 6w to 30d', () => {
      expect(rangeUtil.roundInterval(3628799999)).toEqual(2592000000);
    });

    it('rounds >6w to 1y', () => {
      expect(rangeUtil.roundInterval(3628800000)).toEqual(31536000000);
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
