import { isBreakdownLayoutType } from './types';

describe('types', () => {
  it('isBreakdownLayoutType should return true for rows', () => {
    const expected = true;
    const result = isBreakdownLayoutType('rows');
    expect(result).toBe(expected);
  });

  it('isBreakdownLayoutType should return false for undefined', () => {
    const expected = false;
    const result1 = isBreakdownLayoutType(undefined);
    const result2 = isBreakdownLayoutType('undefined');
    const result3 = isBreakdownLayoutType(null);
    const result4 = isBreakdownLayoutType('null');
    expect(result1).toBe(expected);
    expect(result2).toBe(expected);
    expect(result3).toBe(expected);
    expect(result4).toBe(expected);
  });
});
