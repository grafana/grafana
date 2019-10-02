import { equal, intersect } from './set';

describe('equal', () => {
  it('returns false for two sets of differing sizes', () => {
    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([4, 5, 6, 7]);
    expect(equal(s1, s2)).toBe(false);
  });
  it('returns false for two sets where one is a subset of the other', () => {
    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([1, 2, 3, 4]);
    expect(equal(s1, s2)).toBe(false);
  });
  it('returns false for two sets with uncommon elements', () => {
    const s1 = new Set([1, 2, 3, 4]);
    const s2 = new Set([1, 2, 5, 6]);
    expect(equal(s1, s2)).toBe(false);
  });
  it('returns false for two deeply equivalent sets', () => {
    const s1 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
    const s2 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
    expect(equal(s1, s2)).toBe(false);
  });
  it('returns true for two sets with the same elements', () => {
    const s1 = new Set([1, 2, 3, 4]);
    const s2 = new Set([4, 3, 2, 1]);
    expect(equal(s1, s2)).toBe(true);
  });
});

describe('intersect', () => {
  it('returns an empty set for two sets without any common elements', () => {
    const s1 = new Set([1, 2, 3, 4]);
    const s2 = new Set([5, 6, 7, 8]);
    expect(intersect(s1, s2)).toEqual(new Set());
  });
  it('returns an empty set for two deeply equivalent sets', () => {
    const s1 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
    const s2 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
    expect(intersect(s1, s2)).toEqual(new Set());
  });
  it('returns a set containing common elements between two sets of the same size', () => {
    const s1 = new Set([1, 2, 3, 4]);
    const s2 = new Set([5, 2, 7, 4]);
    expect(intersect(s1, s2)).toEqual(new Set([2, 4]));
  });
  it('returns a set containing common elements between two sets of differing sizes', () => {
    const s1 = new Set([1, 2, 3, 4]);
    const s2 = new Set([5, 4, 3, 2, 1]);
    expect(intersect(s1, s2)).toEqual(new Set([1, 2, 3, 4]));
  });
});
