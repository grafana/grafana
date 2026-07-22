import { canonicalZoneName, findTimeZoneAt } from './easytz_lookup';

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

  it('resolves a legacy spelling to the canonical entry', () => {
    // easy-tz includes both spellings of its curated canonical/legacy pairs
    // regardless of which one the runtime's ICU lists; the lookup returns the
    // canonical entry for both.
    expect(findTimeZoneAt('Asia/Kolkata', JUL)).toMatchObject({ name: 'Asia/Kolkata', abbr: 'IST' });
    expect(findTimeZoneAt('Asia/Calcutta', JUL)).toBe(findTimeZoneAt('Asia/Kolkata', JUL));
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
        const lookup = await import('./easytz_lookup');

        // A dashboard saved on Chrome (or by an older, moment-based Grafana)
        // may have persisted the legacy spelling; it must still resolve, and
        // to the canonical entry.
        expect(lookup.findTimeZoneAt('Asia/Calcutta', JAN)).toMatchObject({
          name: 'Asia/Kolkata',
          abbr: 'IST',
          offset: '+05:30',
        });
        expect(lookup.canonicalZoneName('Asia/Calcutta', JAN)).toBe('Asia/Kolkata');
      });
    } finally {
      spy.mockRestore();
    }
  });
});
