import { __awaiter, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { ALL_VARIABLE_TEXT } from '../constants';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { isAllVariable, toKeyedVariableIdentifier } from '../utils';
import { CustomVariableEditor } from './CustomVariableEditor';
import { updateCustomVariableOptions } from './actions';
import { customVariableReducer, initialCustomVariableModelState } from './reducer';
export const createCustomVariableAdapter = () => {
    return {
        id: 'custom',
        description: 'Define variable values manually',
        name: 'Custom',
        initialState: initialCustomVariableModelState,
        reducer: customVariableReducer,
        picker: optionPickerFactory(),
        editor: CustomVariableEditor,
        dependsOn: () => {
            return false;
        },
        setValue: (variable, option, emitChanges = false) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
        }),
        setValueFromUrl: (variable, urlValue) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
        }),
        updateOptions: (variable) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(updateCustomVariableOptions(toKeyedVariableIdentifier(variable)));
        }),
        getSaveModel: (variable) => {
            const _a = cloneDeep(variable), { index, id, state, global, rootStateKey } = _a, rest = __rest(_a, ["index", "id", "state", "global", "rootStateKey"]);
            return rest;
        },
        getValueForUrl: (variable) => {
            if (isAllVariable(variable)) {
                return ALL_VARIABLE_TEXT;
            }
            return variable.current.value;
        },
    };
};
//# sourceMappingURL=adapter.js.map