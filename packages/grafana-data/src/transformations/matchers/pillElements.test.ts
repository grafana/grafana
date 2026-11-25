import { getPillElements } from './pillElements';
import { splitFilterElements } from './valueMatchers/setMatchers';

describe('getPillElements', () => {
  it('parses JSON arrays, splits the rest on commas', () => {
    expect(getPillElements('["a","b"]')).toEqual(['a', 'b']);
    expect(getPillElements('a, b')).toEqual(['a', 'b']);
    expect(getPillElements('[a, b')).toEqual(['[a', 'b']);
  });

  it('comma-splits JSON that does not start with [ (only [ attempts parsing)', () => {
    expect(getPillElements('{"a":1}')).toEqual(['{"a":1}']);
  });

  it('yields an empty element list for an empty JSON array', () => {
    expect(getPillElements('[]')).toEqual([]);
  });

  it("yields [''] for a blank string; callers map blanks themselves", () => {
    // Rendering (inferPills) maps '' to [] and filtering (splitFilterElements)
    // maps '' to ['']; the helper itself just returns the plain split result.
    expect(getPillElements('')).toEqual(['']);
  });

  it('stringifies non-string scalars like rendering does', () => {
    expect(getPillElements(42)).toEqual(['42']);
  });

  it('trims array entries and drops nullish items', () => {
    expect(getPillElements([' a ', null, 'b '])).toEqual(['a', 'b']);
  });

  it('memoizes strings by value and arrays by reference', () => {
    expect(getPillElements('m,n')).toBe(getPillElements('m,n'));
    const arr = ['x'];
    expect(getPillElements(arr)).toBe(getPillElements(arr));
  });

  it('re-splits an array that grew after caching', () => {
    const arr: unknown[] = ['a'];
    expect(getPillElements(arr)).toEqual(['a']);
    arr.push('b');
    expect(getPillElements(arr)).toEqual(['a', 'b']);
  });
});

describe('element cache behavior', () => {
  it('evicts untouched entries under churn but keeps recently read ones promoted', () => {
    const kept = getPillElements('cache-kept,me');
    expect(kept).toEqual(['cache-kept', 'me']);
    const dropped = getPillElements('cache-dropped,me');
    // Churn well past twice the cache capacity, re-reading `kept` so it stays
    // promoted in the current generation while `dropped` rotates out.
    for (let i = 0; i < 40000; i++) {
      getPillElements(`cache-churn-${i},x`);
      if (i % 100 === 0) {
        getPillElements('cache-kept,me');
      }
    }
    // The untouched early key rotated out (same values, fresh array) while the
    // promoted key is still the identical cached array.
    expect(getPillElements('cache-dropped,me')).not.toBe(dropped);
    expect(getPillElements('cache-dropped,me')).toEqual(['cache-dropped', 'me']);
    expect(getPillElements('cache-kept,me')).toBe(kept);
  });
});

describe('shared cache reuse', () => {
  it('filtering reuses the same cached arrays as rendering', () => {
    expect(splitFilterElements('r,s')).toBe(getPillElements('r,s'));
    const arr = ['t'];
    expect(splitFilterElements(arr)).toBe(getPillElements(arr));
  });
});
