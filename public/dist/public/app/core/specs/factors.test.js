import getFactors from 'app/core/utils/factors';
describe('factors', function () {
    it('should return factors for 12', function () {
        var factors = getFactors(12);
        expect(factors).toEqual([1, 2, 3, 4, 6, 12]);
    });
});
//# sourceMappingURL=factors.test.js.map