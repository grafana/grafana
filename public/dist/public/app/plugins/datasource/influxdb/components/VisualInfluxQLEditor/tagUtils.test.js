import { adjustOperatorIfNeeded, getCondition, getOperator } from './tagUtils';
describe('InfluxDB InfluxQL Editor tag utils', function () {
    describe('getOperator', function () {
        it('should return an existing operator', function () {
            expect(getOperator({
                key: 'key',
                value: 'value',
                operator: '!=',
            })).toBe('!=');
        });
        it('should return = when missing operator', function () {
            expect(getOperator({
                key: 'key',
                value: 'value',
            })).toBe('=');
        });
    });
    describe('getCondition', function () {
        it('should return an existing condition when not first', function () {
            expect(getCondition({
                key: 'key',
                value: 'value',
                operator: '=',
                condition: 'OR',
            }, false)).toBe('OR');
        });
        it('should return AND when missing condition when not first', function () {
            expect(getCondition({
                key: 'key',
                value: 'value',
                operator: '=',
            }, false)).toBe('AND');
        });
        it('should return undefined for an existing condition when first', function () {
            expect(getCondition({
                key: 'key',
                value: 'value',
                operator: '=',
                condition: 'OR',
            }, true)).toBeUndefined();
        });
        it('should return undefined when missing condition when first', function () {
            expect(getCondition({
                key: 'key',
                value: 'value',
                operator: '=',
            }, true)).toBeUndefined();
        });
    });
    describe('adjustOperatorIfNeeded', function () {
        it('should keep operator when both operator and value are regex', function () {
            expect(adjustOperatorIfNeeded('=~', '/test/')).toBe('=~');
            expect(adjustOperatorIfNeeded('!~', '/test/')).toBe('!~');
        });
        it('should keep operator when both operator and value are not regex', function () {
            expect(adjustOperatorIfNeeded('=', 'test')).toBe('=');
            expect(adjustOperatorIfNeeded('!=', 'test')).toBe('!=');
        });
        it('should change operator to =~ when value is regex and operator is not regex', function () {
            expect(adjustOperatorIfNeeded('<>', '/test/')).toBe('=~');
        });
        it('should change operator to = when value is not regex and operator is regex', function () {
            expect(adjustOperatorIfNeeded('!~', 'test')).toBe('=');
        });
    });
});
//# sourceMappingURL=tagUtils.test.js.map