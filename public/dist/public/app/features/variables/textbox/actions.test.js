import { __awaiter } from "tslib";
import { locationService } from '@grafana/runtime';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../adapters';
import { textboxBuilder } from '../shared/testing/builders';
import { getRootReducer } from '../state/helpers';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../state/sharedReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { setTextBoxVariableOptionsFromUrl, updateTextBoxVariableOptions } from './actions';
import { createTextBoxVariableAdapter } from './adapter';
import { createTextBoxOptions } from './reducer';
jest.mock('@grafana/runtime', () => {
    const original = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, original), { locationService: {
            partial: jest.fn(),
            getSearchObject: () => ({}),
        } });
});
describe('textbox actions', () => {
    variableAdapters.setInit(() => [createTextBoxVariableAdapter()]);
    describe('when updateTextBoxVariableOptions is dispatched', () => {
        it('then correct actions are dispatched', () => __awaiter(void 0, void 0, void 0, function* () {
            const option = {
                value: 'A',
                text: 'A',
                selected: false,
            };
            const key = 'key';
            const variable = textboxBuilder()
                .withId('textbox')
                .withRootStateKey(key)
                .withName('textbox')
                .withCurrent('A')
                .withQuery('A')
                .build();
            const tester = yield reduxTester()
                .givenRootReducer(getRootReducer())
                .whenActionIsDispatched(toKeyedAction(key, addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable }))))
                .whenAsyncActionIsDispatched(updateTextBoxVariableOptions(toKeyedVariableIdentifier(variable)), true);
            tester.thenDispatchedActionsShouldEqual(toKeyedAction(key, createTextBoxOptions(toVariablePayload(variable))), toKeyedAction(key, setCurrentVariableValue(toVariablePayload(variable, { option }))));
            expect(locationService.partial).toHaveBeenLastCalledWith({ 'var-textbox': 'A' });
        }));
    });
    describe('when setTextBoxVariableOptionsFromUrl is dispatched', () => {
        it('then correct actions are dispatched', () => __awaiter(void 0, void 0, void 0, function* () {
            const urlValue = 'bB';
            const key = 'key';
            const variable = textboxBuilder()
                .withId('textbox')
                .withRootStateKey(key)
                .withName('textbox')
                .withCurrent('A')
                .withQuery('A')
                .build();
            const tester = yield reduxTester()
                .givenRootReducer(getRootReducer())
                .whenActionIsDispatched(toKeyedAction(key, addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable }))))
                .whenAsyncActionIsDispatched(setTextBoxVariableOptionsFromUrl(toKeyedVariableIdentifier(variable), urlValue), true);
            tester.thenDispatchedActionsShouldEqual(toKeyedAction(key, changeVariableProp(toVariablePayload(variable, { propName: 'query', propValue: 'bB' }))), toKeyedAction(key, setCurrentVariableValue(toVariablePayload(variable, { option: { text: 'bB', value: 'bB', selected: false } }))));
        }));
    });
});
//# sourceMappingURL=actions.test.js.map