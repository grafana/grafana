import { mapOptionToRelativeTimeRange, mapRelativeTimeRangeToOption } from './mapper';

describe('mapper', () => {
  describe('mapRelativeTimeRangeToOption', () => {
    it('should map relative time range to timeoption', () => {
      const relativeTimeRange = { from: 600, to: 0 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-600s', to: 'now', display: 'something readable' });
    });

    it('should handle two relative ranges', () => {
      const relativeTimeRange = { from: 600, to: 300 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-600s', to: 'now-300s', display: 'something readable' });
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
