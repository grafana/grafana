import { createBoundedCache, inferPills } from './pills';

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

describe('createBoundedCache', () => {
  it('returns stored values and undefined for absent keys', () => {
    const cache = createBoundedCache<string, number>(8);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the oldest entries once churn exceeds capacity', () => {
    const cache = createBoundedCache<number, number>(4);
    for (let i = 0; i < 100; i++) {
      cache.set(i, i);
    }
    // early keys have rotated out; the most recent ones are still present
    expect(cache.get(0)).toBeUndefined();
    expect(cache.get(99)).toBe(99);
  });

  it('stays within ~2x maxSize even when reads continuously promote from the secondary generation', () => {
    // Regression: promotion in get() must run the same rotation check as set(); otherwise a run of
    // promoting reads grows the primary map past maxSize and the ~2x bound is lost.
    const maxSize = 8;
    const cache = createBoundedCache<number, number>(maxSize);
    const total = 2000;
    for (let i = 0; i < total; i++) {
      cache.set(i, i);
      // re-read a window of recent keys to exercise the secondary->primary promotion path
      for (let j = Math.max(0, i - 2 * maxSize); j <= i; j++) {
        cache.get(j);
      }
    }
    let retained = 0;
    for (let i = 0; i < total; i++) {
      if (cache.get(i) !== undefined) {
        retained++;
      }
    }
    expect(retained).toBeLessThanOrEqual(2 * maxSize);
  });
});
