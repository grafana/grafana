import { __assign, __awaiter, __generator } from "tslib";
import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { setTextBoxVariableOptionsFromUrl, updateTextBoxVariableOptions } from './actions';
import { getRootReducer } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createTextBoxOptions } from './reducer';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../state/sharedReducer';
import { textboxBuilder } from '../shared/testing/builders';
import { locationService } from '@grafana/runtime';
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    return __assign(__assign({}, original), { locationService: {
            partial: jest.fn(),
            getSearchObject: function () { return ({}); },
        } });
});
describe('textbox actions', function () {
    variableAdapters.setInit(function () { return [createTextBoxVariableAdapter()]; });
    describe('when updateTextBoxVariableOptions is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var option, variable, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        option = {
                            value: 'A',
                            text: 'A',
                            selected: false,
                        };
                        variable = textboxBuilder().withId('textbox').withName('textbox').withCurrent('A').withQuery('A').build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(updateTextBoxVariableOptions(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(createTextBoxOptions(toVariablePayload(variable)), setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                        expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-textbox': 'A' });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when setTextBoxVariableOptionsFromUrl is dispatched', function () {
        it('then correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var urlValue, variable, tester;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        urlValue = 'bB';
                        variable = textboxBuilder().withId('textbox').withName('textbox').withCurrent('A').withQuery('A').build();
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(setTextBoxVariableOptionsFromUrl(toVariablePayload(variable), urlValue), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: 'bB' })), setCurrentVariableValue(toVariablePayload(variable, { option: { text: 'bB', value: 'bB', selected: false } })));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=actions.test.js.map