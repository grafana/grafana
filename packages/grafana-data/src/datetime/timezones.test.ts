import { getTimeZoneInfo } from './timezones';
import { setTimeZoneResolver } from './common';

describe('getTimeZoneInfo', () => {
  // global timezone is set to UTC, see jest-config.js file

  describe('IANA canonical name of the timezone', () => {
    it('should resolve for default timezone', () => {
      setTimeZoneResolver(() => 'browser');
      const result = getTimeZoneInfo('', Date.now());
      expect(result?.ianaName).toBe('Africa/Abidjan');
    });

    it('should resolve for browser timezone', () => {
      // global timezone is set to UTC
      const result = getTimeZoneInfo('browser', Date.now());
      expect(result?.ianaName).toBe('Africa/Abidjan');
    });
    it('should resolve for utc timezone', () => {
      // global timezone is set to UTC
      const result = getTimeZoneInfo('utc', Date.now());
      expect(result?.ianaName).toBe('UTC');
    });

    it('should resolve for given timezone', () => {
      // global timezone is set to UTC
      const result = getTimeZoneInfo('Europe/Warsaw', Date.now());
      expect(result?.ianaName).toBe('Europe/Warsaw');
    });
  });
});
