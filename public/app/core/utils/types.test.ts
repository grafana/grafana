import { isNotNullish } from './types';

describe('isNotNullish()', () => {
  it('handles various data-types correctly', () => {
    expect(isNotNullish(null)).toBe(false);
    expect(isNotNullish(undefined)).toBe(false);
    expect(isNotNullish(0)).toBe(true);
    expect(isNotNullish(42)).toBe(true);
    expect(isNotNullish('')).toBe(true);
    expect(isNotNullish('test')).toBe(true);
    expect(isNotNullish(false)).toBe(true);
    expect(isNotNullish(true)).toBe(true);
    expect(isNotNullish([])).toBe(true);
    expect(isNotNullish([1, 2, 3])).toBe(true);
    expect(isNotNullish({})).toBe(true);
    expect(isNotNullish({ a: 1 })).toBe(true);
  });
});
