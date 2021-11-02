import { __makeTemplateObject } from "tslib";
import { containsVariable, ensureStringValues, findTemplateVarChanges, getCurrentText, getVariableRefresh, isAllVariable, } from './utils';
import { VariableRefresh } from './types';
describe('isAllVariable', function () {
    it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    variable                                         | expected\n    ", "                                          | ", "\n    ", "                                     | ", "\n    ", "                                            | ", "\n    ", "                               | ", "\n    ", "                     | ", "\n    ", "                   | ", "\n    ", "              | ", "\n    ", "                 | ", "\n    ", "                  | ", "\n    ", "                     | ", "\n    ", "                 | ", "\n    ", "            | ", "\n    ", "               | ", "\n    ", "        | ", "\n    ", "                | ", "\n    ", "        | ", "\n    ", "      | ", "\n    ", "                    | ", "\n    ", "                  | ", "\n    ", "             | ", "\n    ", "             | ", "\n    ", "              | ", "\n    ", "                    | ", "\n    ", "                | ", "\n    ", "           | ", "\n    ", "           | ", "\n    ", " | ", "\n    ", "            | ", "\n    ", " | ", "\n    ", "     | ", "\n    ", "          | ", "\n    ", "       | ", "\n    ", "    | ", "\n    ", "     | ", "\n    ", "  | ", "\n  "], ["\n    variable                                         | expected\n    ", "                                          | ", "\n    ", "                                     | ", "\n    ", "                                            | ", "\n    ", "                               | ", "\n    ", "                     | ", "\n    ", "                   | ", "\n    ", "              | ", "\n    ", "                 | ", "\n    ", "                  | ", "\n    ", "                     | ", "\n    ", "                 | ", "\n    ", "            | ", "\n    ", "               | ", "\n    ", "        | ", "\n    ", "                | ", "\n    ", "        | ", "\n    ", "      | ", "\n    ", "                    | ", "\n    ", "                  | ", "\n    ", "             | ", "\n    ", "             | ", "\n    ", "              | ", "\n    ", "                    | ", "\n    ", "                | ", "\n    ", "           | ", "\n    ", "           | ", "\n    ", " | ", "\n    ", "            | ", "\n    ", " | ", "\n    ", "     | ", "\n    ", "          | ", "\n    ", "       | ", "\n    ", "    | ", "\n    ", "     | ", "\n    ", "  | ", "\n  "])), null, false, undefined, false, {}, false, { current: {} }, false, { current: { text: '' } }, false, { current: { text: null } }, false, { current: { text: undefined } }, false, { current: { text: 'Alll' } }, false, { current: { text: 'All' } }, true, { current: { text: [] } }, false, { current: { text: [null] } }, false, { current: { text: [undefined] } }, false, { current: { text: ['Alll'] } }, false, { current: { text: ['Alll', 'All'] } }, false, { current: { text: ['All'] } }, true, { current: { text: ['All', 'Alll'] } }, true, { current: { text: { prop1: 'test' } } }, false, { current: { value: '' } }, false, { current: { value: null } }, false, { current: { value: undefined } }, false, { current: { value: '$__alll' } }, false, { current: { value: '$__all' } }, true, { current: { value: [] } }, false, { current: { value: [null] } }, false, { current: { value: [undefined] } }, false, { current: { value: ['$__alll'] } }, false, { current: { value: ['$__alll', '$__all'] } }, false, { current: { value: ['$__all'] } }, true, { current: { value: ['$__all', '$__alll'] } }, true, { current: { value: { prop1: 'test' } } }, false, { current: { value: '', text: '' } }, false, { current: { value: '', text: 'All' } }, true, { current: { value: '$__all', text: '' } }, true, { current: { value: '', text: ['All'] } }, true, { current: { value: ['$__all'], text: '' } }, true)("when called with params: 'variable': '$variable' then result should be '$expected'", function (_a) {
        var variable = _a.variable, expected = _a.expected;
        expect(isAllVariable(variable)).toEqual(expected);
    });
});
describe('getCurrentText', function () {
    it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    variable                                    | expected\n    ", "                                     | ", "\n    ", "                                | ", "\n    ", "                                       | ", "\n    ", "                          | ", "\n    ", "                | ", "\n    ", "              | ", "\n    ", "         | ", "\n    ", "               | ", "\n    ", "             | ", "\n    ", "                | ", "\n    ", "            | ", "\n    ", "       | ", "\n    ", "             | ", "\n    ", "      | ", "\n    ", "           | ", "\n    ", " | ", "\n  "], ["\n    variable                                    | expected\n    ", "                                     | ", "\n    ", "                                | ", "\n    ", "                                       | ", "\n    ", "                          | ", "\n    ", "                | ", "\n    ", "              | ", "\n    ", "         | ", "\n    ", "               | ", "\n    ", "             | ", "\n    ", "                | ", "\n    ", "            | ", "\n    ", "       | ", "\n    ", "             | ", "\n    ", "      | ", "\n    ", "           | ", "\n    ", " | ", "\n  "])), null, '', undefined, '', {}, '', { current: {} }, '', { current: { text: '' } }, '', { current: { text: null } }, '', { current: { text: undefined } }, '', { current: { text: 'A' } }, 'A', { current: { text: 'All' } }, 'All', { current: { text: [] } }, '', { current: { text: [null] } }, '', { current: { text: [undefined] } }, '', { current: { text: ['A'] } }, 'A', { current: { text: ['A', 'All'] } }, 'A,All', { current: { text: ['All'] } }, 'All', { current: { text: { prop1: 'test' } } }, '')("when called with params: 'variable': '$variable' then result should be '$expected'", function (_a) {
        var variable = _a.variable, expected = _a.expected;
        expect(getCurrentText(variable)).toEqual(expected);
    });
});
describe('getVariableRefresh', function () {
    it.each(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    variable                                           | expected\n    ", "                                            | ", "\n    ", "                                       | ", "\n    ", "                                              | ", "\n    ", "              | ", "\n    ", " | ", "\n    ", "    | ", "\n    ", "                          | ", "\n  "], ["\n    variable                                           | expected\n    ", "                                            | ", "\n    ", "                                       | ", "\n    ", "                                              | ", "\n    ", "              | ", "\n    ", " | ", "\n    ", "    | ", "\n    ", "                          | ", "\n  "])), null, VariableRefresh.never, undefined, VariableRefresh.never, {}, VariableRefresh.never, { refresh: VariableRefresh.never }, VariableRefresh.never, { refresh: VariableRefresh.onTimeRangeChanged }, VariableRefresh.onTimeRangeChanged, { refresh: VariableRefresh.onDashboardLoad }, VariableRefresh.onDashboardLoad, { refresh: 'invalid' }, VariableRefresh.never)("when called with params: 'variable': '$variable' then result should be '$expected'", function (_a) {
        var variable = _a.variable, expected = _a.expected;
        expect(getVariableRefresh(variable)).toEqual(expected);
    });
});
describe('findTemplateVarChanges', function () {
    it('detect adding/removing a variable', function () {
        var a = {};
        var b = {
            'var-xyz': 'hello',
            aaa: 'ignore me',
        };
        expect(findTemplateVarChanges(b, a)).toEqual({ 'var-xyz': { value: 'hello' } });
        expect(findTemplateVarChanges(a, b)).toEqual({ 'var-xyz': { value: '', removed: true } });
    });
    it('then should ignore equal values', function () {
        var a = {
            'var-xyz': 'hello',
            bbb: 'ignore me',
        };
        var b = {
            'var-xyz': 'hello',
            aaa: 'ignore me',
        };
        expect(findTemplateVarChanges(b, a)).toBeUndefined();
        expect(findTemplateVarChanges(a, b)).toBeUndefined();
    });
    it('then should ignore equal values with empty values', function () {
        var a = {
            'var-xyz': '',
            bbb: 'ignore me',
        };
        var b = {
            'var-xyz': '',
            aaa: 'ignore me',
        };
        expect(findTemplateVarChanges(b, a)).toBeUndefined();
        expect(findTemplateVarChanges(a, b)).toBeUndefined();
    });
    it('then should ignore empty array values', function () {
        var a = {
            'var-adhoc': [],
        };
        var b = {};
        expect(findTemplateVarChanges(b, a)).toBeUndefined();
        expect(findTemplateVarChanges(a, b)).toBeUndefined();
    });
    it('Should handle array values with one value same as just value', function () {
        var a = {
            'var-test': ['test'],
        };
        var b = {
            'var-test': 'test',
        };
        expect(findTemplateVarChanges(b, a)).toBeUndefined();
        expect(findTemplateVarChanges(a, b)).toBeUndefined();
    });
    it('Should detect change in array value and return array with single value', function () {
        var a = {
            'var-test': ['test'],
        };
        var b = {
            'var-test': 'asd',
        };
        expect(findTemplateVarChanges(a, b)['var-test']).toEqual({ value: ['test'] });
    });
});
describe('ensureStringValues', function () {
    it.each(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    value              | expected\n    ", "            | ", "\n    ", "       | ", "\n    ", "              | ", "\n    ", " | ", "\n    ", "               | ", "\n    ", "          | ", "\n    ", "             | ", "\n    ", "      | ", "\n    ", "            | ", "\n  "], ["\n    value              | expected\n    ", "            | ", "\n    ", "       | ", "\n    ", "              | ", "\n    ", " | ", "\n    ", "               | ", "\n    ", "          | ", "\n    ", "             | ", "\n    ", "      | ", "\n    ", "            | ", "\n  "])), null, '', undefined, '', {}, '', { current: {} }, '', 1, '1', [1, 2], ['1', '2'], '1', '1', ['1', '2'], ['1', '2'], true, 'true')('when called with value:$value then result should be:$expected', function (_a) {
        var value = _a.value, expected = _a.expected;
        expect(ensureStringValues(value)).toEqual(expected);
    });
});
describe('containsVariable', function () {
    it.each(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    value                               | expected\n    ", "                               | ", "\n    ", "                           | ", "\n    ", "             | ", "\n    ", "      | ", "\n    ", " | ", "\n  "], ["\n    value                               | expected\n    ", "                               | ", "\n    ", "                           | ", "\n    ", "             | ", "\n    ", "      | ", "\n    ", " | ", "\n  "])), '', false, '$var', true, { thing1: '${var}' }, true, { thing1: ['1', '${var}'] }, true, { thing1: { thing2: '${var}' } }, true)('when called with value:$value then result should be:$expected', function (_a) {
        var value = _a.value, expected = _a.expected;
        expect(containsVariable(value, 'var')).toEqual(expected);
    });
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=utils.test.js.map