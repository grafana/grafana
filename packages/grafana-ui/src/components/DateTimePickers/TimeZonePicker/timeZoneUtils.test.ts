import { formatUtcOffset } from './TimeZoneOffset';
import { canonicalZoneName, findTimeZoneAt, guessBrowserTimeZone, resolveIanaName } from './timeZoneUtils';

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

  it('resolves both spellings of a zone', () => {
    // Node's ICU (like Chrome's) lists the legacy Asia/Calcutta; easy-tz adds
    // the canonical Asia/Kolkata as its own entry, so both spellings resolve.
    expect(findTimeZoneAt('Asia/Kolkata', JUL)).toMatchObject({ name: 'Asia/Kolkata', abbr: 'IST' });
    expect(findTimeZoneAt('Asia/Calcutta', JUL)).toMatchObject({
      name: 'Asia/Calcutta',
      aliasOf: 'Asia/Kolkata',
      abbr: 'IST',
    });
  });

  it('memoizes per hour bucket', () => {
    expect(findTimeZoneAt('America/New_York', JAN)).toBe(findTimeZoneAt('America/New_York', JAN + 1));
  });

  it('returns undefined for unknown zones', () => {
    expect(findTimeZoneAt('Foo/Bar', JUL)).toBeUndefined();
    expect(findTimeZoneAt('', JUL)).toBeUndefined();
  });
});

describe('canonicalZoneName', () => {
  // Node's ICU (like Chrome's) lists these zones under their legacy spelling,
  // which is what makes the aliasOf-derived mapping available.
  it('maps legacy spellings to their canonical IANA id', () => {
    expect(canonicalZoneName('Asia/Calcutta', JAN)).toBe('Asia/Kolkata');
    expect(canonicalZoneName('Europe/Kiev', JAN)).toBe('Europe/Kyiv');
    expect(canonicalZoneName('America/Buenos_Aires', JAN)).toBe('America/Argentina/Buenos_Aires');
  });

  it('passes canonical and unknown names through unchanged', () => {
    expect(canonicalZoneName('Asia/Kolkata', JAN)).toBe('Asia/Kolkata');
    expect(canonicalZoneName('America/New_York', JAN)).toBe('America/New_York');
    expect(canonicalZoneName('Foo/Bar', JAN)).toBe('Foo/Bar');
  });
});

describe('on runtimes that list only canonical zone ids (e.g. Firefox)', () => {
  it('still resolves persisted legacy spellings', async () => {
    // Node's ICU lists the legacy Asia/Calcutta (like Chrome). Simulate a
    // Firefox-like runtime where only the canonical Asia/Kolkata exists.
    const canonicalOnly = [...new Set([...Intl.supportedValuesOf('timeZone'), 'Asia/Kolkata'])]
      .filter((zone) => zone !== 'Asia/Calcutta')
      .sort();

    const spy = jest.spyOn(Intl, 'supportedValuesOf').mockReturnValue(canonicalOnly);

    try {
      // easytz snapshots the runtime zone list at module load, so evaluate a
      // fresh module registry under the mocked runtime.
      await jest.isolateModulesAsync(async () => {
        const utils = await import('./timeZoneUtils');
        const { formatUtcOffset } = await import('./TimeZoneOffset');

        // A dashboard saved on Chrome (or by an older, moment-based Grafana)
        // may have persisted the legacy spelling; it must still resolve.
        expect(utils.findTimeZoneAt('Asia/Calcutta', JAN)).toMatchObject({
          aliasOf: 'Asia/Kolkata',
          abbr: 'IST',
          offset: '+05:30',
        });
        expect(utils.canonicalZoneName('Asia/Calcutta', JAN)).toBe('Asia/Kolkata');
        expect(formatUtcOffset(JAN, 'Asia/Calcutta')).toBe('UTC+05:30');
      });
    } finally {
      spy.mockRestore();
    }
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
