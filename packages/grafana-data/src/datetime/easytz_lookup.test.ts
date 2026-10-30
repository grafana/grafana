import { canonicalZoneName, findTimeZoneAt, getTimeZonesAt } from './easytz_lookup';

// Fixed timestamps so DST-dependent results are deterministic.
const JAN = Date.UTC(2026, 0, 15); // northern winter / southern summer
const JUL = Date.UTC(2026, 6, 15); // northern summer / southern winter

describe('getTimeZonesAt', () => {
  it('memoizes augmented lists per hour bucket', () => {
    expect(getTimeZonesAt(JAN)).toBe(getTimeZonesAt(JAN + 1));
  });
});

describe('findTimeZoneAt', () => {
  it('returns DST-correct abbreviation and offset', () => {
    expect(findTimeZoneAt('America/New_York', JAN)).toMatchObject({ abbr: 'EST', offsetDisplay: '-05:00' });
    expect(findTimeZoneAt('America/New_York', JUL)).toMatchObject({ abbr: 'EDT', offsetDisplay: '-04:00' });
    expect(findTimeZoneAt('Europe/Paris', JAN)).toMatchObject({ abbr: 'CET', offsetDisplay: '+01:00' });
    expect(findTimeZoneAt('Europe/Paris', JUL)).toMatchObject({ abbr: 'CEST', offsetDisplay: '+02:00' });
  });

  it('inverts DST for the southern hemisphere', () => {
    expect(findTimeZoneAt('Australia/Sydney', JAN)).toMatchObject({ abbr: 'AEDT', offsetDisplay: '+11:00' });
    expect(findTimeZoneAt('Australia/Sydney', JUL)).toMatchObject({ abbr: 'AEST', offsetDisplay: '+10:00' });
  });

  it('handles zones without DST', () => {
    expect(findTimeZoneAt('Asia/Kolkata', JAN)).toMatchObject({ abbr: 'IST', offsetDisplay: '+05:30' });
    expect(findTimeZoneAt('Asia/Kolkata', JUL)).toMatchObject({ abbr: 'IST', offsetDisplay: '+05:30' });
  });

  it('resolves a legacy spelling to the canonical entry', () => {
    // easy-tz includes both spellings of its curated canonical/legacy pairs
    // regardless of which one the runtime's ICU lists; the lookup returns the
    // canonical entry for both.
    expect(findTimeZoneAt('Asia/Kolkata', JUL)).toMatchObject({ name: 'Asia/Kolkata', abbr: 'IST' });
    expect(findTimeZoneAt('Asia/Calcutta', JUL)).toBe(findTimeZoneAt('Asia/Kolkata', JUL));
  });

  it('returns cached instances within an hour bucket', () => {
    const info = findTimeZoneAt('America/New_York', JAN);

    expect(info).toBe(findTimeZoneAt('America/New_York', JAN + 1));
    expect(info).toBe(getTimeZonesAt(JAN).find((tz) => tz.name === 'America/New_York'));
    expect(Object.isFrozen(info)).toBe(true);
  });

  it('returns undefined for unknown zones', () => {
    expect(findTimeZoneAt('Foo/Bar', JUL)).toBeUndefined();
    expect(findTimeZoneAt('', JUL)).toBeUndefined();
  });

  // British Columbia stays at UTC−7 after 2026-11-01 02:00 Pacific. The vendored
  // rules still fall Vancouver back with Los Angeles, which shows 12:00Z as 04:00.
  describe('America/Vancouver after British Columbia ended daylight saving', () => {
    const noon = (iso: string) => Date.parse(iso);
    const beforeFallback = noon('2026-11-01T08:59:59Z');
    const atFallback = noon('2026-11-01T09:00:00Z');
    const december = noon('2026-12-01T12:00:00Z');

    it('keeps the old Pacific schedule until the last fall-back instant', () => {
      expect(findTimeZoneAt('America/Vancouver', noon('2026-01-01T12:00:00Z'))).toMatchObject({
        abbr: 'PST',
        offset: -480,
        offsetDisplay: '-08:00',
      });
      expect(findTimeZoneAt('America/Vancouver', noon('2026-07-01T12:00:00Z'))).toMatchObject({
        abbr: 'PDT',
        offset: -420,
        offsetDisplay: '-07:00',
      });
      expect(findTimeZoneAt('America/Vancouver', beforeFallback)).toMatchObject({
        abbr: 'PDT',
        offset: -420,
        offsetDisplay: '-07:00',
      });
    });

    it('stays at UTC−7 from the old fall-back instant onward', () => {
      expect(findTimeZoneAt('America/Vancouver', atFallback)).toMatchObject({
        abbr: 'MST',
        offset: -420,
        offsetDisplay: '-07:00',
      });
      expect(findTimeZoneAt('America/Vancouver', december)).toMatchObject({
        abbr: 'MST',
        offset: -420,
        offsetDisplay: '-07:00',
      });
      expect(findTimeZoneAt('America/Vancouver', noon('2027-01-01T12:00:00Z'))).toMatchObject({
        abbr: 'MST',
        offset: -420,
        offsetDisplay: '-07:00',
      });
    });

    it('does not change America/Los_Angeles', () => {
      expect(findTimeZoneAt('America/Los_Angeles', december)).toMatchObject({
        abbr: 'PST',
        offset: -480,
        offsetDisplay: '-08:00',
      });
    });

    it('uses the same entry in the zone list as a direct lookup', () => {
      const direct = findTimeZoneAt('America/Vancouver', december);
      expect(getTimeZonesAt(december).find((tz) => tz.name === 'America/Vancouver')).toBe(direct);
    });
  });
});

describe('canonicalZoneName', () => {
  it('maps legacy spellings to their canonical IANA id', () => {
    expect(canonicalZoneName('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(canonicalZoneName('Europe/Kiev')).toBe('Europe/Kyiv');
    expect(canonicalZoneName('America/Buenos_Aires')).toBe('America/Argentina/Buenos_Aires');
  });

  it('passes canonical and unknown names through unchanged', () => {
    expect(canonicalZoneName('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(canonicalZoneName('America/New_York')).toBe('America/New_York');
    expect(canonicalZoneName('Foo/Bar')).toBe('Foo/Bar');
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
        const lookup = await import('./easytz_lookup');

        // A dashboard saved on Chrome (or by an older, moment-based Grafana)
        // may have persisted the legacy spelling; it must still resolve, and
        // to the canonical entry.
        expect(lookup.findTimeZoneAt('Asia/Calcutta', JAN)).toMatchObject({
          name: 'Asia/Kolkata',
          abbr: 'IST',
          offsetDisplay: '+05:30',
        });
        expect(lookup.canonicalZoneName('Asia/Calcutta')).toBe('Asia/Kolkata');
      });
    } finally {
      spy.mockRestore();
    }
  });
});
