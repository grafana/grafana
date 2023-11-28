import { __awaiter, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent } from '../state/actions';
import { toKeyedVariableIdentifier } from '../utils';
import { TextBoxVariableEditor } from './TextBoxVariableEditor';
import { TextBoxVariablePicker } from './TextBoxVariablePicker';
import { setTextBoxVariableOptionsFromUrl, updateTextBoxVariableOptions } from './actions';
import { initialTextBoxVariableModelState, textBoxVariableReducer } from './reducer';
export const createTextBoxVariableAdapter = () => {
    return {
        id: 'textbox',
        description: 'Define a textbox variable, where users can enter any arbitrary string',
        name: 'Text box',
        initialState: initialTextBoxVariableModelState,
        reducer: textBoxVariableReducer,
        picker: TextBoxVariablePicker,
        editor: TextBoxVariableEditor,
        dependsOn: (variable, variableToTest) => {
            return false;
        },
        setValue: (variable, option, emitChanges = false) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
        }),
        setValueFromUrl: (variable, urlValue) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setTextBoxVariableOptionsFromUrl(toKeyedVariableIdentifier(variable), urlValue));
        }),
        updateOptions: (variable) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(updateTextBoxVariableOptions(toKeyedVariableIdentifier(variable)));
        }),
        getSaveModel: (variable, saveCurrentAsDefault) => {
            const _a = cloneDeep(variable), { index, id, state, global, originalQuery, rootStateKey } = _a, rest = __rest(_a, ["index", "id", "state", "global", "originalQuery", "rootStateKey"]);
            if (variable.query !== originalQuery && !saveCurrentAsDefault) {
                const origQuery = originalQuery !== null && originalQuery !== void 0 ? originalQuery : '';
                const current = { selected: false, text: origQuery, value: origQuery };
                return Object.assign(Object.assign({}, rest), { query: origQuery, current, options: [current] });
            }
            return rest;
        },
        getValueForUrl: (variable) => {
            return variable.current.value;
        },
        beforeAdding: (model) => {
            return Object.assign(Object.assign({}, cloneDeep(model)), { originalQuery: model.query });
        },
    };
};
//# sourceMappingURL=adapter.js.map