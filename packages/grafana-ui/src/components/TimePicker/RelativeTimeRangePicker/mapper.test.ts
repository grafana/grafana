import { mapOptionToRelativeTimeRange, mapRelativeTimeRangeToOption } from './mapper';

describe('mapper', () => {
  describe('mapRelativeTimeRangeToOption', () => {
    it('should map relative time range from minutes to time option', () => {
      const relativeTimeRange = { from: 600, to: 0 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-10m', to: 'now', display: 'Last 10 minutes' });
    });

    it('should map relative time range from one hour to time option', () => {
      const relativeTimeRange = { from: 3600, to: 0 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-1h', to: 'now', display: 'Last 1 hour' });
    });

    it('should map relative time range from hours to time option', () => {
      const relativeTimeRange = { from: 7200, to: 0 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-2h', to: 'now', display: 'Last 2 hours' });
    });

    it('should handle two relative ranges', () => {
      const relativeTimeRange = { from: 600, to: 300 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-10m', to: 'now-5m', display: 'Last 10 minutes, 5 minutes ago' });
    });

    it('should handle two relative ranges with single/multiple units', () => {
      const relativeTimeRange = { from: 6000, to: 300 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({
        from: 'now-100m',
        to: 'now-5m',
        display: 'Last 1 hour and 40 minutes, 5 minutes ago',
      });
    });

    it('should handle two relative ranges with two units', () => {
      const relativeTimeRange = { from: 8460, to: 300 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({
        from: 'now-141m',
        to: 'now-5m',
        display: 'Last 2 hours and 21 minutes, 5 minutes ago',
      });
    });

    it('should handle two relative ranges with two units where the second one is singular', () => {
      const relativeTimeRange = { from: 7260, to: 300 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({
        from: 'now-121m',
        to: 'now-5m',
        display: 'Last 2 hours and 1 minute, 5 minutes ago',
      });
    });
  });

  describe('mapOptionToRelativeTimeRange', () => {
    it('should map simple case', () => {
      const timeOption = { from: 'now-10m', to: 'now', display: 'asdfasdf' };
      const relativeTimeRange = mapOptionToRelativeTimeRange(timeOption);

      expect(relativeTimeRange).toEqual({ from: 600, to: 0 });
    });

    it('should map advanced case', () => {
      const timeOption = { from: 'now-1d', to: 'now-12h', display: 'asdfasdf' };
      const relativeTimeRange = mapOptionToRelativeTimeRange(timeOption);

      expect(relativeTimeRange).toEqual({ from: 86400, to: 43200 });
    });
  });
});
