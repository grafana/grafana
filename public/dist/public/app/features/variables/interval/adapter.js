import { __awaiter, __rest } from "tslib";
import { cloneDeep } from 'lodash';
import { dispatch } from '../../../store/store';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { toKeyedVariableIdentifier } from '../utils';
import { IntervalVariableEditor } from './IntervalVariableEditor';
import { updateAutoValue, updateIntervalVariableOptions } from './actions';
import { initialIntervalVariableModelState, intervalVariableReducer } from './reducer';
export const createIntervalVariableAdapter = () => {
    return {
        id: 'interval',
        description: 'Define a timespan interval (ex 1m, 1h, 1d)',
        name: 'Interval',
        initialState: initialIntervalVariableModelState,
        reducer: intervalVariableReducer,
        picker: optionPickerFactory(),
        editor: IntervalVariableEditor,
        dependsOn: () => {
            return false;
        },
        setValue: (variable, option, emitChanges = false) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(updateAutoValue(toKeyedVariableIdentifier(variable)));
            yield dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
        }),
        setValueFromUrl: (variable, urlValue) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(updateAutoValue(toKeyedVariableIdentifier(variable)));
            yield dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
        }),
        updateOptions: (variable) => __awaiter(void 0, void 0, void 0, function* () {
            yield dispatch(updateIntervalVariableOptions(toKeyedVariableIdentifier(variable)));
        }),
        getSaveModel: (variable) => {
            const _a = cloneDeep(variable), { index, id, state, global, rootStateKey } = _a, rest = __rest(_a, ["index", "id", "state", "global", "rootStateKey"]);
            return rest;
        },
        getValueForUrl: (variable) => {
            return variable.current.value;
        },
    };
};
//# sourceMappingURL=adapter.js.map