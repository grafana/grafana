import { __assign, __awaiter, __generator } from "tslib";
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { updateConstantVariableOptions } from './actions';
import { getRootReducer } from '../state/helpers';
import { initialVariableModelState } from '../types';
import { toVariablePayload } from '../state/types';
import { createConstantOptionsFromQuery } from './reducer';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
describe('constant actions', function () {
    variableAdapters.setInit(function () { return [createConstantVariableAdapter()]; });
    describe('when updateConstantVariableOptions is dispatched', function () {
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
                        variable = __assign(__assign({}, initialVariableModelState), { id: '0', index: 0, type: 'constant', name: 'Constant', current: {
                                value: '',
                                text: '',
                                selected: false,
                            }, options: [], query: 'A' });
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
                                .whenAsyncActionIsDispatched(updateConstantVariableOptions(toVariablePayload(variable)), true)];
                    case 1:
                        tester = _a.sent();
                        tester.thenDispatchedActionsShouldEqual(createConstantOptionsFromQuery(toVariablePayload(variable)), setCurrentVariableValue(toVariablePayload(variable, { option: option })));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=actions.test.js.map