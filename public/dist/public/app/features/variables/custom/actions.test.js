import { __assign, __awaiter, __generator } from "tslib";
import { variableAdapters } from '../adapters';
import { updateCustomVariableOptions } from './actions';
import { createCustomVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer } from '../state/helpers';
import { initialVariableModelState } from '../types';
import { toVariablePayload } from '../state/types';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { createCustomOptionsFromQuery } from './reducer';
describe('custom actions', function () {
    variableAdapters.setInit(function () { return [createCustomVariableAdapter()]; });
    describe('when updateCustomVariableOptions is dispatched', function () {
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
                        variable = __assign(__assign({}, initialVariableModelState), { id: '0', index: 0, type: 'custom', name: 'Custom', current: {
                                value: '',
                                text: '',
                                selected: false,
                            }, options: [
                                {
                                    text: 'A',
                                    value: 'A',
                                    selected: false,
                                },
                                {
                                    text: 'B',
                                    value: 'B',
                                    selected: false,
                                },
                            ], query: 'A,B', multi: true, includeAll: false });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(updateCustomVariableOptions(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(createCustomOptionsFromQuery(toVariablePayload(variable)), setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=actions.test.js.map