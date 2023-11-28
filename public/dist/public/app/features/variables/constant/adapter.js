import { __awaiter, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { toKeyedVariableIdentifier } from '../utils';
import { ConstantVariableEditor } from './ConstantVariableEditor';
import { updateConstantVariableOptions } from './actions';
import { constantVariableReducer, initialConstantVariableModelState } from './reducer';
export const createConstantVariableAdapter = () => {
    return {
        id: 'constant',
        description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share.',
        name: 'Constant',
        initialState: initialConstantVariableModelState,
        reducer: constantVariableReducer,
        picker: optionPickerFactory(),
        editor: ConstantVariableEditor,
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
            yield dispatch(updateConstantVariableOptions(toKeyedVariableIdentifier(variable)));
        }),
        getSaveModel: (variable) => {
            const _a = cloneDeep(variable), { index, id, state, global, current, options, rootStateKey } = _a, rest = __rest(_a, ["index", "id", "state", "global", "current", "options", "rootStateKey"]);
            return rest;
        },
        getValueForUrl: (variable) => {
            return variable.current.value;
        },
        beforeAdding: (model) => {
            const _a = cloneDeep(model), { current, options, query } = _a, rest = __rest(_a, ["current", "options", "query"]);
            const option = { selected: true, text: query, value: query };
            return Object.assign(Object.assign({}, rest), { current: option, options: [option], query });
        },
    };
};
//# sourceMappingURL=adapter.js.map