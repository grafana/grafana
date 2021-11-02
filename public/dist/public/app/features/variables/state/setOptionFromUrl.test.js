import { __awaiter, __generator, __makeTemplateObject } from "tslib";
import { variableAdapters } from '../adapters';
import { createCustomVariableAdapter } from '../custom/adapter';
import { customBuilder } from '../shared/testing/builders';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getTemplatingRootReducer } from './helpers';
import { addVariable, setCurrentVariableValue } from './sharedReducer';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, toVariableIdentifier, toVariablePayload } from './types';
import { setOptionFromUrl } from './actions';
variableAdapters.setInit(function () { return [createCustomVariableAdapter()]; });
describe('when setOptionFromUrl is dispatched with a custom variable (no refresh property)', function () {
    it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    urlValue      | isMulti  | expected\n    ", "        | ", " | ", "\n    ", "      | ", " | ", "\n    ", "        | ", " | ", "\n    ", "         | ", " | ", "\n    ", "       | ", " | ", "\n    ", "  | ", " | ", "\n    ", "        | ", "  | ", "\n    ", "      | ", "  | ", "\n    ", "        | ", "  | ", "\n    ", "         | ", "  | ", "\n    ", " | ", "  | ", "\n    ", "       | ", "  | ", "\n    ", "  | ", "  | ", "\n  "], ["\n    urlValue      | isMulti  | expected\n    ", "        | ", " | ", "\n    ", "      | ", " | ", "\n    ", "        | ", " | ", "\n    ", "         | ", " | ", "\n    ", "       | ", " | ", "\n    ", "  | ", " | ", "\n    ", "        | ", "  | ", "\n    ", "      | ", "  | ", "\n    ", "        | ", "  | ", "\n    ", "         | ", "  | ", "\n    ", " | ", "  | ", "\n    ", "       | ", "  | ", "\n    ", "  | ", "  | ", "\n  "])), 'B', false, 'B', ['B'], false, 'B', 'X', false, 'X', '', false, '', null, false, '', undefined, false, '', 'B', true, ['B'], ['B'], true, ['B'], 'X', true, ['X'], '', true, [''], ['A', 'B'], true, ['A', 'B'], null, true, [''], undefined, true, [''])('and urlValue is $urlValue then correct actions are dispatched', function (_a) {
        var urlValue = _a.urlValue, expected = _a.expected, isMulti = _a.isMulti;
        return __awaiter(void 0, void 0, void 0, function () {
            var custom, tester;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        custom = customBuilder().withId('0').withMulti(isMulti).withOptions('A', 'B', 'C').withCurrent('A').build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getTemplatingRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                                .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true)];
                    case 1:
                        tester = _b.sent();
                        return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'custom', id: '0' }, { option: { text: expected, value: expected, selected: false } })))];
                    case 2:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    });
});
describe('when setOptionFromUrl is dispatched for a variable with a custom all value', function () {
    it('and urlValue contains same all value then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allValue, urlValue, custom, tester;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allValue = '.*';
                    urlValue = allValue;
                    custom = customBuilder()
                        .withId('0')
                        .withMulti(false)
                        .withIncludeAll()
                        .withAllValue(allValue)
                        .withOptions('A', 'B', 'C')
                        .withCurrent('A')
                        .build();
                    return [4 /*yield*/, reduxTester()
                            .givenRootReducer(getTemplatingRootReducer())
                            .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                            .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true)];
                case 1:
                    tester = _a.sent();
                    return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'custom', id: '0' }, { option: { text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false } })))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('and urlValue differs from all value then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allValue, urlValue, custom, tester;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allValue = '.*';
                    urlValue = 'X';
                    custom = customBuilder()
                        .withId('0')
                        .withMulti(false)
                        .withIncludeAll()
                        .withAllValue(allValue)
                        .withOptions('A', 'B', 'C')
                        .withCurrent('A')
                        .build();
                    return [4 /*yield*/, reduxTester()
                            .givenRootReducer(getTemplatingRootReducer())
                            .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                            .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true)];
                case 1:
                    tester = _a.sent();
                    return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'custom', id: '0' }, { option: { text: 'X', value: 'X', selected: false } })))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('and urlValue differs but matches an option then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allValue, urlValue, custom, tester;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allValue = '.*';
                    urlValue = 'B';
                    custom = customBuilder()
                        .withId('0')
                        .withMulti(false)
                        .withIncludeAll()
                        .withAllValue(allValue)
                        .withOptions('A', 'B', 'C')
                        .withCurrent('A')
                        .build();
                    return [4 /*yield*/, reduxTester()
                            .givenRootReducer(getTemplatingRootReducer())
                            .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                            .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true)];
                case 1:
                    tester = _a.sent();
                    return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'custom', id: '0' }, { option: { text: 'B', value: 'B', selected: false } })))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('and custom all value matches an option', function () { return __awaiter(void 0, void 0, void 0, function () {
        var allValue, urlValue, custom, tester;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    allValue = '.*';
                    urlValue = allValue;
                    custom = customBuilder()
                        .withId('0')
                        .withMulti(false)
                        .withIncludeAll()
                        .withAllValue(allValue)
                        .withOptions('A', 'B', '.*')
                        .withCurrent('A')
                        .build();
                    custom.options[2].value = 'special value for .*';
                    return [4 /*yield*/, reduxTester()
                            .givenRootReducer(getTemplatingRootReducer())
                            .whenActionIsDispatched(addVariable(toVariablePayload(custom, { global: false, index: 0, model: custom })))
                            .whenAsyncActionIsDispatched(setOptionFromUrl(toVariableIdentifier(custom), urlValue), true)];
                case 1:
                    tester = _a.sent();
                    return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(setCurrentVariableValue(toVariablePayload({ type: 'custom', id: '0' }, { option: { text: '.*', value: 'special value for .*', selected: false } })))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
var templateObject_1;
//# sourceMappingURL=setOptionFromUrl.test.js.map