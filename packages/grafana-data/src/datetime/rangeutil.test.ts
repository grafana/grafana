import { dateTime, rangeUtil } from './index';

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
});
