import { formatUtcOffset } from './TimeZoneOffset';
import { findTimeZoneAt, guessBrowserTimeZone, offsetToMinutes, resolveIanaName } from './timeZoneUtils';

// Fixed timestamps so DST-dependent results are deterministic.
const JAN = Date.UTC(2026, 0, 15); // northern winter / southern summer
const JUL = Date.UTC(2026, 6, 15); // northern summer / southern winter

describe('findTimeZoneAt', () => {
  it('returns DST-correct abbreviation and offset', () => {
    expect(findTimeZoneAt('America/New_York', JAN)).toMatchObject({ abbr: 'EST', offset: '-05:00' });
    expect(findTimeZoneAt('America/New_York', JUL)).toMatchObject({ abbr: 'EDT', offset: '-04:00' });
    expect(findTimeZoneAt('Europe/Paris', JAN)).toMatchObject({ abbr: 'CET', offset: '+01:00' });
    expect(findTimeZoneAt('Europe/Paris', JUL)).toMatchObject({ abbr: 'CEST', offset: '+02:00' });
  });

  it('inverts DST for the southern hemisphere', () => {
    expect(findTimeZoneAt('Australia/Sydney', JAN)).toMatchObject({ abbr: 'AEDT', offset: '+11:00' });
    expect(findTimeZoneAt('Australia/Sydney', JUL)).toMatchObject({ abbr: 'AEST', offset: '+10:00' });
  });

  it('handles zones without DST', () => {
    expect(findTimeZoneAt('Asia/Kolkata', JAN)).toMatchObject({ abbr: 'IST', offset: '+05:30' });
    expect(findTimeZoneAt('Asia/Kolkata', JUL)).toMatchObject({ abbr: 'IST', offset: '+05:30' });
  });

  it('resolves zones the runtime lists under a legacy spelling', () => {
    // Node's ICU lists Asia/Calcutta; the canonical Asia/Kolkata must resolve
    // to the same entry through the aliasOf index.
    expect(findTimeZoneAt('Asia/Kolkata', JUL)?.abbr).toBe('IST');
  });

  it('returns undefined for unknown zones', () => {
    expect(findTimeZoneAt('Foo/Bar', JUL)).toBeUndefined();
    expect(findTimeZoneAt('', JUL)).toBeUndefined();
  });
});

describe('offsetToMinutes', () => {
  it('parses easy-tz offset strings into minutes east of UTC', () => {
    expect(offsetToMinutes('+00:00')).toBe(0);
    expect(offsetToMinutes('-05:00')).toBe(-300);
    expect(offsetToMinutes('+05:30')).toBe(330);
    expect(offsetToMinutes('-03:30')).toBe(-210);
    expect(offsetToMinutes('+14:00')).toBe(840);
  });
});

describe('guessBrowserTimeZone', () => {
  it('returns a non-empty IANA zone name', () => {
    const zone = guessBrowserTimeZone();
    expect(typeof zone).toBe('string');
    expect(zone.length).toBeGreaterThan(0);
    // Cached: repeated calls return the identical value.
    expect(guessBrowserTimeZone()).toBe(zone);
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
    expect(formatUtcOffset(JUL, 'America/New_York')).toBe('UTC-04:00');
    expect(formatUtcOffset(JUL, 'Asia/Kolkata')).toBe('UTC+05:30');
  });

  it('resolves the internal utc zone', () => {
    expect(formatUtcOffset(JAN, 'utc')).toBe('UTC+00:00');
  });

  it('falls back to UTC+00:00 for unknown zones', () => {
    expect(formatUtcOffset(JAN, 'Foo/Bar')).toBe('UTC+00:00');
  });
});
