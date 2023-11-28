import { __awaiter, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { ALL_VARIABLE_TEXT } from '../constants';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableRefresh } from '../types';
import { containsVariable, isAllVariable, toKeyedVariableIdentifier } from '../utils';
import { QueryVariableEditor } from './QueryVariableEditor';
import { updateQueryVariableOptions } from './actions';
import { initialQueryVariableModelState, queryVariableReducer } from './reducer';
export const createQueryVariableAdapter = () => {
    return {
        id: 'query',
        description: 'Variable values are fetched from a datasource query',
        name: 'Query',
        initialState: initialQueryVariableModelState,
        reducer: queryVariableReducer,
        picker: optionPickerFactory(),
        editor: QueryVariableEditor,
        dependsOn: (variable, variableToTest) => {
            var _a;
            return containsVariable(variable.query, (_a = variable.datasource) === null || _a === void 0 ? void 0 : _a.uid, variable.regex, variableToTest.name);
        },
        setValue: (variable, option, emitChanges = false) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
        }),
        setValueFromUrl: (variable, urlValue) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
        }),
        updateOptions: (variable, searchFilter) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(updateQueryVariableOptions(toKeyedVariableIdentifier(variable), searchFilter));
        }),
        getSaveModel: (variable) => {
            const _a = cloneDeep(variable), { index, id, state, global, queryValue, rootStateKey } = _a, rest = __rest(_a, ["index", "id", "state", "global", "queryValue", "rootStateKey"]);
            // remove options
            if (variable.refresh !== VariableRefresh.never) {
                return Object.assign(Object.assign({}, rest), { options: [] });
            }
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