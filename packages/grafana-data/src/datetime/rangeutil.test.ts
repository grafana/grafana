import { initRegionalFormatForTests } from '@grafana/i18n';

import { RawTimeRange, TimeRange } from '../types/time';
import * as featureToggles from '../utils/featureToggles';

import { dateTime } from './moment_wrapper';
import {
  convertRawToRange,
  describeInterval,
  describeTimeRange,
  isRelativeTimeRange,
  relativeToTimeRange,
  roundInterval,
  timeRangeToRelative,
} from './rangeutil';

describe('Range Utils', () => {
  // These tests probably wrap the dateTimeParser tests to some extent
  describe('convertRawToRange', () => {
    const DEFAULT_DATE_VALUE = '1996-07-30 16:00:00'; // Default format YYYY-MM-DD HH:mm:ss
    const DEFAULT_DATE_VALUE_FORMATTED = '1996-07-30T16:00:00-06:00';
    const defaultRawTimeRange = {
      from: DEFAULT_DATE_VALUE,
      to: '1996-07-30 16:20:00',
    };

    it('should serialize the default format by default', () => {
      const deserialized = convertRawToRange(defaultRawTimeRange);
      expect(deserialized.from.format()).toBe(DEFAULT_DATE_VALUE_FORMATTED);
    });

    it('should serialize using custom formats', () => {
      const NON_DEFAULT_FORMAT = 'DD-MM-YYYY HH:mm:ss';
      const nonDefaultRawTimeRange: RawTimeRange = {
        from: '30-07-1996 16:00:00',
        to: '30-07-1996 16:20:00',
      };

      const deserializedTimeRange = convertRawToRange(nonDefaultRawTimeRange, undefined, undefined, NON_DEFAULT_FORMAT);
      expect(deserializedTimeRange.from.format()).toBe(DEFAULT_DATE_VALUE_FORMATTED);
    });

    it('should take timezone into account', () => {
      const deserializedTimeRange = convertRawToRange(defaultRawTimeRange, 'UTC');
      expect(deserializedTimeRange.from.format()).toBe('1996-07-30T16:00:00Z');
    });

    it('should leave the raw part intact if it has calculations', () => {
      const timeRange = {
        from: 'now-6h',
        to: 'now',
      };

      const deserialized = convertRawToRange(timeRange);
      expect(deserialized.from).not.toBe(timeRange.from);
      expect(deserialized.raw.from).not.toBe(deserialized.from);
      expect(deserialized.raw.from).toBe(timeRange.from);
      expect(deserialized.to).not.toBe(timeRange.to);
      expect(deserialized.raw.to).not.toBe(deserialized.from);
      expect(deserialized.raw.to).toBe(timeRange.to);
    });

    it('should leave the raw part intact if it has calculations for "from"', () => {
      const timeRange = {
        from: 'now',
        to: DEFAULT_DATE_VALUE,
      };

      const deserialized = convertRawToRange(timeRange);
      expect(deserialized.from).not.toBe(timeRange.from);
      expect(deserialized.raw.from).not.toBe(deserialized.from);
      expect(deserialized.raw.from).toBe(timeRange.from);
      expect(deserialized.to).not.toBe(timeRange.to);
      expect(deserialized.raw.to).toBe(deserialized.to);
      expect(deserialized.raw.to).not.toBe(timeRange.to);
    });

    it('should leave the raw part intact if it has calculations for "to"', () => {
      const timeRange = {
        from: DEFAULT_DATE_VALUE,
        to: 'now',
      };

      const deserialized = convertRawToRange(timeRange);
      expect(deserialized.from).not.toBe(timeRange.from);
      expect(deserialized.raw.from).toBe(deserialized.from);
      expect(deserialized.raw.from).not.toBe(timeRange.from);
      expect(deserialized.to).not.toBe(timeRange.to);
      expect(deserialized.raw.to).not.toBe(deserialized.to);
      expect(deserialized.raw.to).toBe(timeRange.to);
    });

    // Test case for the reported issue: now/d+17h should be today at 17:00, not tomorrow at 17:00
    describe('time picker issue with now/d+17h', () => {
      beforeEach(() => {
        // Set a fixed time for consistent testing: 2025-09-11 10:00:00
        const fixedTime = dateTime('2025-09-11T10:00:00Z').valueOf();
        jest.useFakeTimers({ now: fixedTime });
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('now/d+17h should be today at 17:00 when using UTC timezone', () => {
        const timeRange = {
          from: 'now/d+9h',
          to: 'now/d+17h',
        };

        const deserialized = convertRawToRange(timeRange, 'utc');

        // The "to" field should be today at 17:00 UTC
        expect(deserialized.to.format('YYYY-MM-DD HH:mm:ss')).toBe('2025-09-11 17:00:00');
        expect(deserialized.to.format('Z')).toBe('+00:00'); // UTC timezone
      });

      it('now/d+17h should be today at 17:00 when using browser timezone', () => {
        const timeRange = {
          from: 'now/d+9h',
          to: 'now/d+17h',
        };

        const deserialized = convertRawToRange(timeRange, 'browser');

        // The "to" field should be today at 17:00 in the local timezone
        expect(deserialized.to.format('YYYY-MM-DD HH:mm:ss')).toBe('2025-09-11 17:00:00');
      });

      it('should handle the exact scenario from the issue', () => {
        // User enters "now/d+9h" in From and "now/d+17h" in To
        const timeRange = {
          from: 'now/d+9h',
          to: 'now/d+17h',
        };

        const deserialized = convertRawToRange(timeRange, 'browser');

        // Both should be on the same day (2025-09-11)
        expect(deserialized.from.format('YYYY-MM-DD')).toBe('2025-09-11');
        expect(deserialized.to.format('YYYY-MM-DD')).toBe('2025-09-11');

        // From should be 09:00, To should be 17:00
        expect(deserialized.from.format('HH:mm:ss')).toBe('09:00:00');
        expect(deserialized.to.format('HH:mm:ss')).toBe('17:00:00');
      });
    });
  });

  describe('relative time', () => {
    it('should identify relative time range', () => {
      const relative: RawTimeRange = { from: 'now-6h', to: 'now' };
      expect(isRelativeTimeRange(relative)).toBe(true);
    });

    it('should identify absolute time range', () => {
      const absolute: RawTimeRange = { from: dateTime(), to: dateTime() };
      expect(isRelativeTimeRange(absolute)).toBe(false);
    });
  });

  describe('describeInterval', () => {
    it('should format milliseconds', () => {
      expect(describeInterval('100ms')).toBe('100 milliseconds');
    });

    it('should format seconds', () => {
      expect(describeInterval('10s')).toBe('10 seconds');
    });

    it('should format minutes', () => {
      expect(describeInterval('5m')).toBe('5 minutes');
    });

    it('should format hours', () => {
      expect(describeInterval('2h')).toBe('2 hours');
    });

    it('should format days', () => {
      expect(describeInterval('7d')).toBe('7 days');
    });

    it('should format weeks', () => {
      expect(describeInterval('1w')).toBe('1 week');
    });

    it('should format months', () => {
      expect(describeInterval('3M')).toBe('3 months');
    });

    it('should format years', () => {
      expect(describeInterval('1y')).toBe('1 year');
    });

    it('should handle pluralization of months', () => {
      expect(describeInterval('1M')).toBe('1 month');
    });

    it('should handle pluralization of years', () => {
      expect(describeInterval('1y')).toBe('1 year');
    });
  });

  describe('roundInterval', () => {
    it('should round 9ms to 1ms', () => {
      expect(roundInterval(9)).toBe(1);
    });

    it('should round 14ms to 10ms', () => {
      expect(roundInterval(14)).toBe(10);
    });

    it('should round 34ms to 20ms', () => {
      expect(roundInterval(34)).toBe(20);
    });

    it('should round 74ms to 50ms', () => {
      expect(roundInterval(74)).toBe(50);
    });

    it('should round 149ms to 100ms', () => {
      expect(roundInterval(149)).toBe(100);
    });

    it('should round 349ms to 200ms', () => {
      expect(roundInterval(349)).toBe(200);
    });

    it('should round 749ms to 500ms', () => {
      expect(roundInterval(749)).toBe(500);
    });

    it('should round 1.5s to 1s', () => {
      expect(roundInterval(1500)).toBe(1000);
    });

    it('should round 3.5s to 2s', () => {
      expect(roundInterval(3500)).toBe(2000);
    });

    it('should round 7.5s to 5s', () => {
      expect(roundInterval(7500)).toBe(5000);
    });

    it('should round 12.5s to 10s', () => {
      expect(roundInterval(12500)).toBe(10000);
    });

    it('should round 17.5s to 15s', () => {
      expect(roundInterval(17500)).toBe(15000);
    });

    it('should round 25s to 20s', () => {
      expect(roundInterval(25000)).toBe(20000);
    });

    it('should round 45s to 30s', () => {
      expect(roundInterval(45000)).toBe(30000);
    });

    it('should round 1m30s to 1m', () => {
      expect(roundInterval(90000)).toBe(60000);
    });

    it('should round 3m30s to 2m', () => {
      expect(roundInterval(210000)).toBe(120000);
    });

    it('should round 7m30s to 5m', () => {
      expect(roundInterval(450000)).toBe(300000);
    });

    it('should round 12m30s to 10m', () => {
      expect(roundInterval(750000)).toBe(600000);
    });

    it('should round 17m30s to 15m', () => {
      expect(roundInterval(1050000)).toBe(900000);
    });

    it('should round 25m to 20m', () => {
      expect(roundInterval(1500000)).toBe(1200000);
    });

    it('should round 45m to 30m', () => {
      expect(roundInterval(2700000)).toBe(1800000);
    });

    it('should round 1h30m to 1h', () => {
      expect(roundInterval(5400000)).toBe(3600000);
    });

    it('should round 3h30m to 2h', () => {
      expect(roundInterval(12600000)).toBe(7200000);
    });

    it('should round 7h30m to 6h', () => {
      expect(roundInterval(27000000)).toBe(21600000);
    });

    it('should round 12h30m to 12h', () => {
      expect(roundInterval(45000000)).toBe(43200000);
    });

    it('should round 17h30m to 12h', () => {
      expect(roundInterval(63000000)).toBe(43200000);
    });

    it('should round 25h to 1d', () => {
      expect(roundInterval(90000000)).toBe(86400000);
    });

    it('should round 3d12h to 2d', () => {
      expect(roundInterval(302400000)).toBe(172800000);
    });

    it('should round 7d to 1w', () => {
      expect(roundInterval(604800000)).toBe(604800000);
    });

    it('should round 3w to 1M', () => {
      expect(roundInterval(1814400000)).toBe(2592000000);
    });

    it('should round 6w to 3M', () => {
      expect(roundInterval(3628800000)).toBe(7776000000);
    });

    it('should round 3M to 1y', () => {
      expect(roundInterval(7776000000)).toBe(31536000000);
    });
  });

  describe('timeRangeToRelative', () => {
    it('should convert absolute time range to relative', () => {
      const absolute: TimeRange = {
        from: dateTime([2014, 1, 1]),
        to: dateTime([2014, 1, 2]),
        raw: { from: dateTime([2014, 1, 1]), to: dateTime([2014, 1, 2]) },
      };

      const relative = timeRangeToRelative(absolute, dateTime([2014, 1, 2]));
      expect(relative.from).toBe('now-1d');
      expect(relative.to).toBe('now');
    });

    it('should handle time ranges that span multiple days', () => {
      const absolute: TimeRange = {
        from: dateTime([2014, 1, 1]),
        to: dateTime([2014, 1, 3]),
        raw: { from: dateTime([2014, 1, 1]), to: dateTime([2014, 1, 3]) },
      };

      const relative = timeRangeToRelative(absolute, dateTime([2014, 1, 3]));
      expect(relative.from).toBe('now-2d');
      expect(relative.to).toBe('now');
    });
  });

  describe('relativeToTimeRange', () => {
    it('should convert relative time range to absolute', () => {
      const relative = { from: 'now-6h', to: 'now' };
      const absolute = relativeToTimeRange(relative, dateTime([2014, 1, 1]));

      expect(absolute.from.format()).toBe(dateTime([2013, 12, 31, 18]).format());
      expect(absolute.to.format()).toBe(dateTime([2014, 1, 1]).format());
    });

    it('should handle time ranges that span multiple days', () => {
      const relative = { from: 'now-2d', to: 'now' };
      const absolute = relativeToTimeRange(relative, dateTime([2014, 1, 3]));

      expect(absolute.from.format()).toBe(dateTime([2014, 1, 1]).format());
      expect(absolute.to.format()).toBe(dateTime([2014, 1, 3]).format());
    });
  });

  describe('describeTimeRange', () => {
    beforeEach(() => {
      initRegionalFormatForTests('en-US');
    });

    it('should describe relative time range', () => {
      const relative: TimeRange = {
        from: dateTime([2014, 1, 1]),
        to: dateTime([2014, 1, 2]),
        raw: { from: 'now-6h', to: 'now' },
      };

      const description = describeTimeRange(relative, 'browser');
      expect(description).toBe('Last 6 hours');
    });

    it('should describe absolute time range', () => {
      const absolute: TimeRange = {
        from: dateTime([2014, 1, 1]),
        to: dateTime([2014, 1, 2]),
        raw: { from: dateTime([2014, 1, 1]), to: dateTime([2014, 1, 2]) },
      };

      const description = describeTimeRange(absolute, 'browser');
      expect(description).toContain('Jan 1, 2014');
      expect(description).toContain('Jan 2, 2014');
    });
  });
});
