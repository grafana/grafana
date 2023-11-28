import { __awaiter, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { ALL_VARIABLE_TEXT } from '../constants';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { containsVariable, isAllVariable, toKeyedVariableIdentifier } from '../utils';
import { DataSourceVariableEditor } from './DataSourceVariableEditor';
import { updateDataSourceVariableOptions } from './actions';
import { dataSourceVariableReducer, initialDataSourceVariableModelState } from './reducer';
export const createDataSourceVariableAdapter = () => {
    return {
        id: 'datasource',
        description: 'Enables you to dynamically switch the data source for multiple panels.',
        name: 'Data source',
        initialState: initialDataSourceVariableModelState,
        reducer: dataSourceVariableReducer,
        picker: optionPickerFactory(),
        editor: DataSourceVariableEditor,
        dependsOn: (variable, variableToTest) => {
            if (variable.regex) {
                return containsVariable(variable.regex, variableToTest.name);
            }
            return false;
        },
        setValue: (variable, option, emitChanges = false) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
        }),
        setValueFromUrl: (variable, urlValue) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
        }),
        updateOptions: (variable) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(updateDataSourceVariableOptions(toKeyedVariableIdentifier(variable)));
        }),
        getSaveModel: (variable) => {
            const _a = cloneDeep(variable), { index, id, state, global, rootStateKey } = _a, rest = __rest(_a, ["index", "id", "state", "global", "rootStateKey"]);
            return Object.assign(Object.assign({}, rest), { options: [] });
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