import { guessBrowserTimeZone } from '@grafana/data';

import { formatUtcOffset } from './TimeZoneOffset';
import { getTimeZoneDisplayInfo, resolveIanaName } from './timeZoneUtils';

// Fixed timestamps so DST-dependent results are deterministic.
const JAN = Date.UTC(2026, 0, 15); // northern winter / southern summer

describe('getTimeZoneDisplayInfo', () => {
  it('resolves internal zones', () => {
    expect(getTimeZoneDisplayInfo('utc', JAN)).toEqual({
      name: 'Coordinated Universal Time',
      abbreviation: 'UTC, GMT',
      offset: '+00:00',
    });
    expect(getTimeZoneDisplayInfo('browser', JAN)).toMatchObject({ name: 'Browser Time' });
  });

  it('handles a plain UTC value even when the runtime does not list it', () => {
    expect(getTimeZoneDisplayInfo('UTC', JAN)).toEqual({
      name: 'UTC',
      abbreviation: 'UTC, GMT',
      offset: '+00:00',
    });
  });

  it('returns undefined for unknown zones', () => {
    expect(getTimeZoneDisplayInfo('Foo/Bar', JAN)).toBeUndefined();
  });
});

describe('resolveIanaName', () => {
  it('maps internal zones to concrete IANA names', () => {
    expect(resolveIanaName('utc')).toBe('UTC');
    expect(resolveIanaName('browser')).toBe(guessBrowserTimeZone());
  });

  it('passes IANA names through unchanged', () => {
    expect(resolveIanaName('Europe/Paris')).toBe('Europe/Paris');
  });
});

describe('formatUtcOffset', () => {
  it('formats the offset at the given timestamp', () => {
    expect(formatUtcOffset(JAN, 'America/New_York')).toBe('UTC-05:00');
  });

  it('resolves the internal utc zone', () => {
    expect(formatUtcOffset(JAN, 'utc')).toBe('UTC+00:00');
  });

  it('falls back to UTC+00:00 for unknown zones', () => {
    expect(formatUtcOffset(JAN, 'Foo/Bar')).toBe('UTC+00:00');
  });
});
