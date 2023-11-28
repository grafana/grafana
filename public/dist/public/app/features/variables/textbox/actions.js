import { __awaiter } from "tslib";
import { variableAdapters } from '../adapters';
import { setOptionFromUrl } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable } from '../state/selectors';
import { changeVariableProp } from '../state/sharedReducer';
import { ensureStringValues, toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { createTextBoxOptions } from './reducer';
export const updateTextBoxVariableOptions = (identifier) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const { rootStateKey, type } = identifier;
        dispatch(toKeyedAction(rootStateKey, createTextBoxOptions(toVariablePayload(identifier))));
        const variableInState = getVariable(identifier, getState());
        if (variableInState.type !== 'textbox') {
            return;
        }
        yield variableAdapters.get(type).setValue(variableInState, variableInState.options[0], true);
    });
};
export const setTextBoxVariableOptionsFromUrl = (identifier, urlValue) => (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
    const { rootStateKey } = identifier;
    const variableInState = getVariable(identifier, getState());
    if (variableInState.type !== 'textbox') {
        return;
    }
    const stringUrlValue = ensureStringValues(urlValue);
    dispatch(toKeyedAction(rootStateKey, changeVariableProp(toVariablePayload(variableInState, { propName: 'query', propValue: stringUrlValue }))));
    yield dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variableInState), stringUrlValue));
});
//# sourceMappingURL=actions.js.map