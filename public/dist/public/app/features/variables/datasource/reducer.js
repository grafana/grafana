import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { initialVariableModelState, VariableRefresh } from '../types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, getInstanceState, initialVariablesState, } from '../state/types';
export var initialDataSourceVariableModelState = __assign(__assign({}, initialVariableModelState), { type: 'datasource', current: {}, regex: '', options: [], query: '', multi: false, includeAll: false, refresh: VariableRefresh.onDashboardLoad });
export var dataSourceVariableSlice = createSlice({
    name: 'templating/datasource',
    initialState: initialVariablesState,
    reducers: {
        createDataSourceOptions: function (state, action) {
            var _a = action.payload.data, sources = _a.sources, regex = _a.regex;
            var options = [];
            var instanceState = getInstanceState(state, action.payload.id);
            for (var i = 0; i < sources.length; i++) {
                var source = sources[i];
                // must match on type
                if (source.meta.id !== instanceState.query) {
                    continue;
                }
                if (isValid(source, regex)) {
                    options.push({ text: source.name, value: source.name, selected: false });
                }
                if (isDefault(source, regex)) {
                    options.push({ text: 'default', value: 'default', selected: false });
                }
            }
            if (options.length === 0) {
                options.push({ text: 'No data sources found', value: '', selected: false });
            }
            if (instanceState.includeAll) {
                options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
            }
            instanceState.options = options;
        },
    },
});
function isValid(source, regex) {
    if (!regex) {
        return true;
    }
    return regex.exec(source.name);
}
function isDefault(source, regex) {
    if (!source.isDefault) {
        return false;
    }
    if (!regex) {
        return true;
    }
    return regex.exec('default');
}
export var dataSourceVariableReducer = dataSourceVariableSlice.reducer;
export var createDataSourceOptions = dataSourceVariableSlice.actions.createDataSourceOptions;
//# sourceMappingURL=reducer.js.map