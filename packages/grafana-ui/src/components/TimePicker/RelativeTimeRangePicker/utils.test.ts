import { isRangeValid, isRelativeFormat, mapOptionToRelativeTimeRange, mapRelativeTimeRangeToOption } from './utils';

describe('utils', () => {
  describe('mapRelativeTimeRangeToOption', () => {
    it('should map relative time range from minutes to time option', () => {
      const relativeTimeRange = { from: 600, to: 0 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-10m', to: 'now', display: 'now-10m to now' });
    });

    it('should map relative time range from one hour to time option', () => {
      const relativeTimeRange = { from: 3600, to: 0 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-1h', to: 'now', display: 'now-1h to now' });
    });

    it('should map relative time range from hours to time option', () => {
      const relativeTimeRange = { from: 7200, to: 0 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-2h', to: 'now', display: 'now-2h to now' });
    });

    it('should handle two relative ranges', () => {
      const relativeTimeRange = { from: 600, to: 300 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({ from: 'now-10m', to: 'now-5m', display: 'now-10m to now-5m' });
    });

    it('should handle two relative ranges with single/multiple units', () => {
      const relativeTimeRange = { from: 6000, to: 300 };
      const timeOption = mapRelativeTimeRangeToOption(relativeTimeRange);

      expect(timeOption).toEqual({
        from: 'now-100m',
        to: 'now-5m',
        display: 'now-100m to now-5m',
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

  describe('isRelativeFormat', () => {
    it('should consider now as a relative format', () => {
      expect(isRelativeFormat('now')).toBe(true);
    });

    it('should consider now-10s as a relative format', () => {
      expect(isRelativeFormat('now-10s')).toBe(true);
    });

    it('should consider now-2000m as a relative format', () => {
      expect(isRelativeFormat('now-2000m')).toBe(true);
    });

    it('should consider now-112334h as a relative format', () => {
      expect(isRelativeFormat('now-112334h')).toBe(true);
    });

    it('should consider now-12d as a relative format', () => {
      expect(isRelativeFormat('now-12d')).toBe(true);
    });

    it('should consider now-53w as a relative format', () => {
      expect(isRelativeFormat('now-53w')).toBe(true);
    });

    it('should consider 123123123 as a relative format', () => {
      expect(isRelativeFormat('123123123')).toBe(false);
    });
  });

  describe('isRangeValid', () => {
    it('should consider now as a valid relative format', () => {
      const result = isRangeValid('now');
      expect(result.isValid).toBe(true);
    });

    it('should consider now-90d as a valid relative format', () => {
      const result = isRangeValid('now-90d');
      expect(result.isValid).toBe(true);
    });

    it('should consider now-90000000d as an invalid relative format', () => {
      const result = isRangeValid('now-90000000d');
      expect(result.isValid).toBe(false);
    });

    it('should consider now-11111111111s as an invalid relative format', () => {
      const result = isRangeValid('now-11111111111s');
      expect(result.isValid).toBe(false);
    });
  });
});
