import { SemVersion, isVersionGtOrEq } from 'app/core/utils/version';
describe('SemVersion', function () {
    var version = '1.0.0-alpha.1';
    describe('parsing', function () {
        it('should parse version properly', function () {
            var semver = new SemVersion(version);
            expect(semver.major).toBe(1);
            expect(semver.minor).toBe(0);
            expect(semver.patch).toBe(0);
            expect(semver.meta).toBe('alpha.1');
        });
    });
    describe('comparing', function () {
        beforeEach(function () {
            version = '3.4.5';
        });
        it('should detect greater version properly', function () {
            var semver = new SemVersion(version);
            var cases = [
                { value: '3.4.5', expected: true },
                { value: '3.4.4', expected: true },
                { value: '3.4.6', expected: false },
                { value: '4', expected: false },
                { value: '3.5', expected: false },
            ];
            cases.forEach(function (testCase) {
                expect(semver.isGtOrEq(testCase.value)).toBe(testCase.expected);
            });
        });
    });
    describe('isVersionGtOrEq', function () {
        it('should compare versions properly (a >= b)', function () {
            var cases = [
                { values: ['3.4.5', '3.4.5'], expected: true },
                { values: ['3.4.5', '3.4.4'], expected: true },
                { values: ['3.4.5', '3.4.6'], expected: false },
                { values: ['3.4', '3.4.0'], expected: true },
                { values: ['3', '3.0.0'], expected: true },
                { values: ['3.1.1-beta1', '3.1'], expected: true },
                { values: ['3.4.5', '4'], expected: false },
                { values: ['3.4.5', '3.5'], expected: false },
                { values: ['6.0.0', '5.2.0'], expected: true },
            ];
            cases.forEach(function (testCase) {
                expect(isVersionGtOrEq(testCase.values[0], testCase.values[1])).toBe(testCase.expected);
            });
        });
    });
});
//# sourceMappingURL=version.test.js.map