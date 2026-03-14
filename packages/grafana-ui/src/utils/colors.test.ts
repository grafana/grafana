import { chunk } from './colors';

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
});
