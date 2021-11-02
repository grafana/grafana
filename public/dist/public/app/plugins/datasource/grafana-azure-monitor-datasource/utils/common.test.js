import { __assign } from "tslib";
import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';
import { hasOption, interpolateVariable } from './common';
describe('AzureMonitor: hasOption', function () {
    it('can find an option in flat array', function () {
        var options = [
            { value: 'a', label: 'a' },
            { value: 'b', label: 'b' },
            { value: 'c', label: 'c' },
        ];
        expect(hasOption(options, 'b')).toBeTruthy();
    });
    it('can not find an option in flat array', function () {
        var options = [
            { value: 'a', label: 'a' },
            { value: 'b', label: 'b' },
            { value: 'c', label: 'c' },
        ];
        expect(hasOption(options, 'not-there')).not.toBeTruthy();
    });
    it('can find an option in a nested group', function () {
        var options = [
            { value: 'a', label: 'a' },
            { value: 'b', label: 'b' },
            {
                label: 'c',
                value: 'c',
                options: [
                    { value: 'c-a', label: 'c-a' },
                    { value: 'c-b', label: 'c-b' },
                    { value: 'c-c', label: 'c-c' },
                ],
            },
            { value: 'd', label: 'd' },
        ];
        expect(hasOption(options, 'c-b')).toBeTruthy();
    });
});
describe('When interpolating variables', function () {
    describe('and value is a string', function () {
        it('should return an unquoted value', function () {
            expect(interpolateVariable('abc', initialCustomVariableModelState)).toEqual('abc');
        });
    });
    describe('and value is a number', function () {
        it('should return an unquoted value', function () {
            expect(interpolateVariable(1000, initialCustomVariableModelState)).toEqual(1000);
        });
    });
    describe('and value is an array of strings', function () {
        it('should return comma separated quoted values', function () {
            expect(interpolateVariable(['a', 'b', 'c'], initialCustomVariableModelState)).toEqual("'a','b','c'");
        });
    });
    describe('and variable allows multi-value and value is a string', function () {
        it('should return a quoted value', function () {
            var variable = __assign(__assign({}, initialCustomVariableModelState), { multi: true });
            expect(interpolateVariable('abc', variable)).toEqual("'abc'");
        });
    });
    describe('and variable contains single quote', function () {
        it('should return a quoted value', function () {
            var variable = __assign(__assign({}, initialCustomVariableModelState), { multi: true });
            expect(interpolateVariable("a'bc", variable)).toEqual("'a'bc'");
        });
    });
    describe('and variable allows all and value is a string', function () {
        it('should return a quoted value', function () {
            var variable = __assign(__assign({}, initialCustomVariableModelState), { includeAll: true });
            expect(interpolateVariable('abc', variable)).toEqual("'abc'");
        });
    });
});
//# sourceMappingURL=common.test.js.map