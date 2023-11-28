import { createSlice } from '@reduxjs/toolkit';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState } from '../state/types';
import { initialVariableModelState, VariableRefresh } from '../types';
export const initialDataSourceVariableModelState = Object.assign(Object.assign({}, initialVariableModelState), { type: 'datasource', current: {}, regex: '', options: [], query: '', multi: false, includeAll: false, refresh: VariableRefresh.onDashboardLoad });
export const dataSourceVariableSlice = createSlice({
    name: 'templating/datasource',
    initialState: initialVariablesState,
    reducers: {
        createDataSourceOptions: (state, action) => {
            const { sources, regex } = action.payload.data;
            const options = [];
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'datasource') {
                return;
            }
            for (let i = 0; i < sources.length; i++) {
                const source = sources[i];
                // must match on type
                if (source.meta.id !== instanceState.query) {
                    continue;
                }
                if (isValid(source, regex)) {
                    options.push({ text: source.name, value: source.uid, selected: false });
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
export const dataSourceVariableReducer = dataSourceVariableSlice.reducer;
export const { createDataSourceOptions } = dataSourceVariableSlice.actions;
//# sourceMappingURL=reducer.js.map