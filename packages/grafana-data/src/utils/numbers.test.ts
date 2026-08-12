import { guessDecimals, roundDecimals } from './numbers';

describe('guessDecimals', () => {
  it.each([
    [10, 0],
    [10.5, 1],
    [0.125, 3],
    [-0.25, 2],
    [0.000001, 6], // largest magnitude still stringified in decimal notation
  ])('counts decimals of plain notation %d', (input, expected) => {
    expect(guessDecimals(input)).toBe(expected);
  });

  it.each([
    [1e-7, 7],
    [5e-7, 7],
    [1.5e-7, 8],
    [-1.5e-7, 8],
    [2.5e-8, 9],
  ])('derives decimals from the exponent for %d (stringified exponentially)', (input, expected) => {
    expect(guessDecimals(input)).toBe(expected);
  });

  it.each([
    [1e21, 0],
    [1.5e21, 0],
    [-1e22, 0],
  ])('returns 0 for large exponential notation %d', (input, expected) => {
    expect(guessDecimals(input)).toBe(expected);
  });

  it('keeps the documented heuristic behavior for imprecise floats', () => {
    expect(guessDecimals(371.499999999999)).toBe(12);
  });

  it('no longer collapses a sub-1e-6 range to zero when picking sparkline precision', () => {
    // The Sparkline fallback: decimals = max(guessDecimals(min), guessDecimals(max))
    const min = 1e-7;
    const max = 5e-7;
    const decimals = Math.max(guessDecimals(min), guessDecimals(max));
    expect(roundDecimals(min, decimals)).not.toBe(roundDecimals(max, decimals));
  });
});
