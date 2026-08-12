import { setTimeZoneResolver } from './common';
import { getTimeZonesAt } from './easytz_lookup';
import { getTimeZoneInfo, getTimeZones } from './timezones';

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
  });
});

describe('getTimeZones', () => {
  it('returns country-backed zones available in the runtime timezone data', () => {
    const availableZones = new Set(getTimeZonesAt(Date.now()).map((zone) => zone.name));
    const timeZones = getTimeZones();

    expect(timeZones).toContain('America/New_York');
    expect(timeZones.every((zone) => availableZones.has(zone))).toBe(true);
  });

  it('maps countries to canonical IANA zones', () => {
    const result = getTimeZoneInfo('America/New_York', Date.UTC(2026, 0, 1));

    expect(result?.countries).toContainEqual({ code: 'US', name: 'United States' });
  });
});
