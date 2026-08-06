import { inferPills } from './pills';

describe('inferPills', () => {
  it('returns an empty array for empty/nullish values', () => {
    expect(inferPills('')).toEqual([]);
    expect(inferPills(null)).toEqual([]);
    expect(inferPills(undefined)).toEqual([]);
  });

  it('trims entries and drops nullish items from an array value', () => {
    expect(inferPills([' a ', 'b', null, 'c '])).toEqual(['a', 'b', 'c']);
  });

  it('parses a JSON-array string', () => {
    expect(inferPills('["a","b","c"]')).toEqual(['a', 'b', 'c']);
  });

  it('splits a comma-separated string, tolerating surrounding whitespace', () => {
    expect(inferPills('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('falls back to comma-splitting when a bracketed value is not valid JSON', () => {
    expect(inferPills('[a, b')).toEqual(['[a', 'b']);
  });

  it('memoizes by input so repeated calls (per resize tick) reuse the same array', () => {
    // string inputs compare by value
    expect(inferPills('a,b,c')).toBe(inferPills('a,b,c'));
    // array inputs compare by reference — the stable field.values[i] ref hits the cache
    const arr = ['x', 'y'];
    expect(inferPills(arr)).toBe(inferPills(arr));
  });
});
