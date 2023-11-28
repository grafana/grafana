import { __awaiter } from "tslib";
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../adapters';
import { getRootReducer } from '../state/helpers';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { initialVariableModelState } from '../types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { updateConstantVariableOptions } from './actions';
import { createConstantVariableAdapter } from './adapter';
import { createConstantOptionsFromQuery } from './reducer';
describe('constant actions', () => {
    variableAdapters.setInit(() => [createConstantVariableAdapter()]);
    describe('when updateConstantVariableOptions is dispatched', () => {
        it('then correct actions are dispatched', () => __awaiter(void 0, void 0, void 0, function* () {
            const option = {
                value: 'A',
                text: 'A',
                selected: false,
            };
            const variable = Object.assign(Object.assign({}, initialVariableModelState), { id: '0', rootStateKey: 'key', index: 0, type: 'constant', name: 'Constant', current: {
                    value: '',
                    text: '',
                    selected: false,
                }, options: [], query: 'A' });
            const tester = yield reduxTester()
                .givenRootReducer(getRootReducer())
                .whenActionIsDispatched(toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable }))))
                .whenAsyncActionIsDispatched(updateConstantVariableOptions(toKeyedVariableIdentifier(variable)), true);
            tester.thenDispatchedActionsShouldEqual(toKeyedAction('key', createConstantOptionsFromQuery(toVariablePayload(variable))), toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option }))));
        }));
    });
});
//# sourceMappingURL=actions.test.js.map