import getFactors from 'app/core/utils/factors';

describe('factors', () => {
  it('should return factors for 12', () => {
    const factors = getFactors(12);
    expect(factors).toEqual([1, 2, 3, 4, 6, 12]);
  });

  it('should return an empty array for non-positive or non-integer values', () => {
    expect(getFactors(0)).toEqual([]);
    expect(getFactors(-5)).toEqual([]);
    expect(getFactors(12.5)).toEqual([]);
  });
});
