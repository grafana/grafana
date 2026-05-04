import { chunk, zip, sortedColors, colors, getTextColorForBackground } from './colors';

describe('colors utilities', () => {
  describe('chunk', () => {
    it('splits an array into groups of the given size', () => {
      expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
    });

    it('handles a last chunk smaller than size', () => {
      expect(chunk([1, 2, 3, 4, 5], 3)).toEqual([
        [1, 2, 3],
        [4, 5],
      ]);
    });

    it('returns an empty array for empty input', () => {
      expect(chunk([], 3)).toEqual([]);
    });

    it('returns single-element chunks when size is 1', () => {
      expect(chunk(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
    });
  });

  describe('zip', () => {
    it('zips arrays of equal length', () => {
      expect(zip([1, 2, 3], [4, 5, 6])).toEqual([
        [1, 4],
        [2, 5],
        [3, 6],
      ]);
    });

    it('handles arrays of different lengths (fills with undefined)', () => {
      const result = zip([1, 2], [3, 4, 5]);
      expect(result).toEqual([
        [1, 3],
        [2, 4],
        [undefined, 5],
      ]);
    });

    it('handles a single array', () => {
      expect(zip([1, 2, 3])).toEqual([[1], [2], [3]]);
    });

    it('returns an empty array when no arrays are provided', () => {
      expect(zip()).toEqual([]);
    });
  });

  describe('sortedColors', () => {
    it('has the same number of colors as the input palette', () => {
      expect(sortedColors).toHaveLength(colors.length);
    });

    it('contains all the same colors as the input palette', () => {
      const sortedSet = new Set(sortedColors.map((c) => c.toLowerCase()));
      const originalSet = new Set(colors.map((c) => c.toLowerCase()));
      expect(sortedSet).toEqual(originalSet);
    });

    it('produces valid hex color strings', () => {
      for (const color of sortedColors) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it('is stable across runs (snapshot)', () => {
      expect(sortedColors).toMatchSnapshot();
    });
  });

  describe('getTextColorForBackground', () => {
    it('returns dark text for light backgrounds', () => {
      expect(getTextColorForBackground('#ffffff')).toBe('rgb(32, 34, 38)');
    });

    it('returns light text for dark backgrounds', () => {
      expect(getTextColorForBackground('#000000')).toBe('rgb(247, 248, 250)');
    });
  });
});
