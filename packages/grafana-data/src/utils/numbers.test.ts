import { guessDecimals, roundDecimals } from './numbers';

describe('roundDecimals', () => {
  it('returns integers untouched', () => {
    expect(roundDecimals(10)).toBe(10);
    expect(roundDecimals(-10, 4)).toBe(-10);
  });

  it('rounds half away from zero, symmetrically', () => {
    expect(roundDecimals(2.5)).toBe(3);
    expect(roundDecimals(-2.5)).toBe(-3);
    expect(roundDecimals(0.5)).toBe(1);
    expect(roundDecimals(-0.5)).toBe(-1);
  });

  it('rounds to the requested number of decimals', () => {
    expect(roundDecimals(0.125, 2)).toBe(0.13);
    expect(roundDecimals(-0.125, 2)).toBe(-0.13);
    expect(roundDecimals(2.675, 2)).toBe(2.68);
  });
});

describe('guessDecimals', () => {
  it('counts decimal places', () => {
    expect(guessDecimals(10)).toBe(0);
    expect(guessDecimals(0.125)).toBe(3);
    expect(guessDecimals(-0.25)).toBe(2);
    expect(guessDecimals(371.5)).toBe(1);
  });

  it('counts decimal places for values stringified in exponential notation', () => {
    // JavaScript switches to exponential below 1e-6, so these do not contain a
    // '.' followed by the decimal expansion.
    expect(guessDecimals(1e-7)).toBe(7);
    expect(guessDecimals(1.5e-7)).toBe(8);
    expect(guessDecimals(5e-324)).toBe(324);
  });

  it('reports no decimals for large values in exponential notation', () => {
    expect(guessDecimals(1e21)).toBe(0);
    expect(guessDecimals(1.5e21)).toBe(0);
  });

  it('is continuous across the notation boundary', () => {
    // 1e-6 stringifies as '0.000001', 1e-7 as '1e-7'.
    expect(guessDecimals(0.000001)).toBe(6);
    expect(guessDecimals(1e-7)).toBe(7);
  });
});
