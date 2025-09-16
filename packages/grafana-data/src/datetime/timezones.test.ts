import { setTimeZoneResolver } from './common';
import { getTimeZoneInfo } from './timezones';

describe('getTimeZoneInfo', () => {
  // global timezone is set to Pacific/Easter, see jest-config.js file

  describe('IANA canonical name of the timezone', () => {
    it('should resolve for default timezone', () => {
      setTimeZoneResolver(() => 'browser');
      const result = getTimeZoneInfo('', Date.now());
      expect(result?.ianaName).toBe('Pacific/Easter');
    });

    it('should resolve for browser timezone', () => {
      const result = getTimeZoneInfo('browser', Date.now());
      expect(result?.ianaName).toBe('Pacific/Easter');
    });

    it('should resolve for utc timezone', () => {
      const result = getTimeZoneInfo('utc', Date.now());
      expect(result?.ianaName).toBe('UTC');
    });

    it('should resolve for given timezone', () => {
      const result = getTimeZoneInfo('Europe/Warsaw', Date.now());
      expect(result?.ianaName).toBe('Europe/Warsaw');
    });

    it('should not think Singapore is in Antarctica', () => {
      const result = getTimeZoneInfo('Asia/Singapore', Date.now());
      expect(result).not.toBeUndefined();
      expect(result!.countries).not.toContainEqual({ code: 'AQ', name: 'Antarctica' });
    });
  });
});
