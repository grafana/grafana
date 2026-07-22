import { FunctionalVector, vectorator } from './FunctionalVector';

class SimpleVector<T> extends FunctionalVector<T> {
  private items: T[];

  constructor(items: T[]) {
    super();
    this.items = items;
  }

  get length(): number {
    return this.items.length;
  }

  get(index: number): T {
    return this.items[index];
  }
}

describe('FunctionalVector', () => {
  describe('iterator protocol', () => {
    it('yields all values via generator', () => {
      const v = new SimpleVector([10, 20, 30]);
      const result: number[] = [];
      for (const val of v.iterator()) {
        result.push(val);
      }
      expect(result).toEqual([10, 20, 30]);
    });

    it('supports for...of via Symbol.iterator', () => {
      const v = new SimpleVector([1, 2, 3]);
      expect([...v]).toEqual([1, 2, 3]);
    });
  });

  describe('unsupported mutation methods throw', () => {
    it('throws for set, add, pop, reverse, shift, sort, splice, unshift, fill, copyWithin, flat, reduce, reduceRight, concat', () => {
      const v = new SimpleVector([1, 2, 3]);
      expect(() => v.set(0, 99)).toThrow();
      expect(() => v.add(99)).toThrow();
      expect(() => v.pop()).toThrow();
      expect(() => v.reverse()).toThrow();
      expect(() => v.shift()).toThrow();
      expect(() => v.sort()).toThrow();
      expect(() => v.splice(0, 1)).toThrow();
      expect(() => v.unshift(0)).toThrow();
      expect(() => v.fill(0)).toThrow();
      expect(() => v.copyWithin(0, 1)).toThrow();
      expect(() => v.reduce((a, b) => a + b)).toThrow();
      expect(() => v.reduceRight((a, b) => a + b)).toThrow();
      expect(() => v.concat([4])).toThrow();
    });
  });

  describe('push', () => {
    it('delegates to add and returns new length', () => {
      const arr = [1, 2];
      class MutableVector extends FunctionalVector<number> {
        constructor(private inner: number[]) {
          super();
        }
        get length() {
          return this.inner.length;
        }
        get(i: number) {
          return this.inner[i];
        }
        override add(v: number) {
          this.inner.push(v);
        }
      }
      const v = new MutableVector(arr);
      expect(v.push(3, 4)).toBe(4);
      expect([...v]).toEqual([1, 2, 3, 4]);
    });
  });

  describe('array conversion and serialization', () => {
    it('toArray returns a plain array with all values', () => {
      const v = new SimpleVector([5, 6, 7]);
      expect(v.toArray()).toEqual([5, 6, 7]);
    });

    it('toJSON returns the same result as toArray', () => {
      const v = new SimpleVector([1, 2, 3]);
      expect(v.toJSON()).toEqual(v.toArray());
    });

    it('join concatenates with a provided separator', () => {
      const v = new SimpleVector(['a', 'b', 'c']);
      expect(v.join('-')).toBe('a-b-c');
    });
  });

  describe('at', () => {
    it('returns element at index via get', () => {
      const v = new SimpleVector([10, 20, 30]);
      expect(v.at(1)).toBe(20);
    });
  });

  describe('delegated array methods', () => {
    it('slice returns a sub-array', () => {
      const v = new SimpleVector([1, 2, 3, 4]);
      expect(v.slice(1, 3)).toEqual([2, 3]);
    });

    it('indexOf returns the correct index, or -1 when absent', () => {
      const v = new SimpleVector([10, 20, 30]);
      expect(v.indexOf(20)).toBe(1);
      expect(v.indexOf(99)).toBe(-1);
    });

    it('lastIndexOf finds a specific occurrence when fromIndex is given', () => {
      const v = new SimpleVector([1, 2, 1, 3]);
      expect(v.lastIndexOf(1, 2)).toBe(2);
    });

    it('every and some evaluate a predicate over all elements', () => {
      const evens = new SimpleVector([2, 4, 6]);
      const mixed = new SimpleVector([1, 2, 3]);
      expect(evens.every((x): x is number => x % 2 === 0)).toBe(true);
      expect(mixed.every((x): x is number => x % 2 === 0)).toBe(false);
      expect(mixed.some((x) => x % 2 === 0)).toBe(true);
      expect(new SimpleVector([1, 3]).some((x) => x % 2 === 0)).toBe(false);
    });

    it('find and findIndex locate the first matching element', () => {
      const v = new SimpleVector([1, 2, 3]);
      expect(v.find((x, _i, _arr): x is number => x > 1)).toBe(2);
      expect(v.find((x, _i, _arr): x is number => x > 10)).toBeUndefined();
      expect(v.findIndex((x) => x > 1)).toBe(1);
      expect(v.findIndex((x) => x > 10)).toBe(-1);
    });

    it('includes returns true for present elements and false for absent ones', () => {
      const v = new SimpleVector([1, 2, 3]);
      expect(v.includes(2)).toBe(true);
      expect(v.includes(99)).toBe(false);
    });

    it('entries, keys, and values return the correct iterators', () => {
      const v = new SimpleVector(['x', 'y']);
      expect([...v.entries()]).toEqual([
        [0, 'x'],
        [1, 'y'],
      ]);
      expect([...v.keys()]).toEqual([0, 1]);
      expect([...v.values()]).toEqual(['x', 'y']);
    });

    it('flatMap maps and flattens one level', () => {
      const v = new SimpleVector([1, 2, 3]);
      expect(v.flatMap((x) => [x, x * 2])).toEqual([1, 2, 2, 4, 3, 6]);
    });

    it('forEach, map, and filter operate on all elements', () => {
      const v = new SimpleVector([1, 2, 3, 4]);
      const seen: number[] = [];
      v.forEach((val) => seen.push(val));
      expect(seen).toEqual([1, 2, 3, 4]);
      expect(v.map((x) => x * 10)).toEqual([10, 20, 30, 40]);
      expect(v.filter((x) => x % 2 === 0)).toEqual([2, 4]);
    });
  });
});

describe('vectorator', () => {
  it('iterates values, maps, and filters correctly', () => {
    const v = new SimpleVector([1, 2, 3, 4, 5]);
    expect([...vectorator(v)]).toEqual([1, 2, 3, 4, 5]);
    expect(vectorator(v).map((x) => x * 2)).toEqual([2, 4, 6, 8, 10]);
    expect(vectorator(v).filter((x) => x > 3)).toEqual([4, 5]);
  });

  it('forEach passes the correct index alongside each value', () => {
    const v = new SimpleVector(['a', 'b', 'c']);
    const seen: Array<[string, number]> = [];
    vectorator(v).forEach((val, idx) => seen.push([val, idx]));
    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });
});
