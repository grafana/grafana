import { SLUG_MAX_LENGTH, slugifyJestTestNameForFilename } from './uplotComparePayload';

describe('slugifyJestTestNameForFilename', () => {
  it('returns "unknown" for empty, whitespace-only, and unsafe-only input', () => {
    try {
      slugifyJestTestNameForFilename('');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
    try {
      slugifyJestTestNameForFilename('   ');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
    try {
      slugifyJestTestNameForFilename('!!!');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('replaces Jest › and > test path separators with underscores', () => {
    expect(slugifyJestTestNameForFilename('Suite › child')).toBe('Suite_child');
    expect(slugifyJestTestNameForFilename('a > b > c')).toBe('a_b_c');
    expect(slugifyJestTestNameForFilename('Panel › uPlot > drawMarkers')).toBe('Panel_uPlot_drawMarkers');
  });

  it('strips combining marks after NFKD (e.g. accents)', () => {
    expect(slugifyJestTestNameForFilename('Café')).toBe('Cafe');
    expect(slugifyJestTestNameForFilename('naïve')).toBe('naive');
  });

  it('truncates to SLUG_MAX_LENGTH and trims trailing underscores from the slice', () => {
    const long = 'a'.repeat(SLUG_MAX_LENGTH + 40);
    expect(slugifyJestTestNameForFilename(long)).toBe('a'.repeat(SLUG_MAX_LENGTH));

    const endsWithUnderscoreAtMax = `${'a'.repeat(SLUG_MAX_LENGTH - 1)}_`;
    expect(endsWithUnderscoreAtMax.length).toBe(SLUG_MAX_LENGTH);
    expect(slugifyJestTestNameForFilename(endsWithUnderscoreAtMax)).toBe('a'.repeat(SLUG_MAX_LENGTH - 1));
  });
});
