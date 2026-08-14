import getFactors from 'app/core/utils/factors';

describe('factors', () => {
  it('should return factors for 12', () => {
    const factors = getFactors(12);
    expect(factors).toEqual([1, 2, 3, 4, 6, 12]);
  });
});
