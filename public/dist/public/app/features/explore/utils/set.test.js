import { equal, intersect } from './set';
describe('equal', function () {
    it('returns false for two sets of differing sizes', function () {
        var s1 = new Set([1, 2, 3]);
        var s2 = new Set([4, 5, 6, 7]);
        expect(equal(s1, s2)).toBe(false);
    });
    it('returns false for two sets where one is a subset of the other', function () {
        var s1 = new Set([1, 2, 3]);
        var s2 = new Set([1, 2, 3, 4]);
        expect(equal(s1, s2)).toBe(false);
    });
    it('returns false for two sets with uncommon elements', function () {
        var s1 = new Set([1, 2, 3, 4]);
        var s2 = new Set([1, 2, 5, 6]);
        expect(equal(s1, s2)).toBe(false);
    });
    it('returns false for two deeply equivalent sets', function () {
        var s1 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
        var s2 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
        expect(equal(s1, s2)).toBe(false);
    });
    it('returns true for two sets with the same elements', function () {
        var s1 = new Set([1, 2, 3, 4]);
        var s2 = new Set([4, 3, 2, 1]);
        expect(equal(s1, s2)).toBe(true);
    });
});
describe('intersect', function () {
    it('returns an empty set for two sets without any common elements', function () {
        var s1 = new Set([1, 2, 3, 4]);
        var s2 = new Set([5, 6, 7, 8]);
        expect(intersect(s1, s2)).toEqual(new Set());
    });
    it('returns an empty set for two deeply equivalent sets', function () {
        var s1 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
        var s2 = new Set([{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }]);
        expect(intersect(s1, s2)).toEqual(new Set());
    });
    it('returns a set containing common elements between two sets of the same size', function () {
        var s1 = new Set([1, 2, 3, 4]);
        var s2 = new Set([5, 2, 7, 4]);
        expect(intersect(s1, s2)).toEqual(new Set([2, 4]));
    });
    it('returns a set containing common elements between two sets of differing sizes', function () {
        var s1 = new Set([1, 2, 3, 4]);
        var s2 = new Set([5, 4, 3, 2, 1]);
        expect(intersect(s1, s2)).toEqual(new Set([1, 2, 3, 4]));
    });
});
//# sourceMappingURL=set.test.js.map