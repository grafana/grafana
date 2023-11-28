import { createSlice } from '@reduxjs/toolkit';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState } from '../state/types';
import { initialVariableModelState } from '../types';
export const initialCustomVariableModelState = Object.assign(Object.assign({}, initialVariableModelState), { type: 'custom', multi: false, includeAll: false, allValue: null, query: '', options: [], current: {} });
export const customVariableSlice = createSlice({
    name: 'templating/custom',
    initialState: initialVariablesState,
    reducers: {
        createCustomOptionsFromQuery: (state, action) => {
            var _a;
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'custom') {
                return;
            }
            const { includeAll, query } = instanceState;
            const match = (_a = query.match(/(?:\\,|[^,])+/g)) !== null && _a !== void 0 ? _a : [];
            const options = match.map((text) => {
                var _a;
                text = text.replace(/\\,/g, ',');
                const textMatch = (_a = /^(.+)\s:\s(.+)$/g.exec(text)) !== null && _a !== void 0 ? _a : [];
                if (textMatch.length === 3) {
                    const [, key, value] = textMatch;
                    return { text: key.trim(), value: value.trim(), selected: false };
                }
                else {
                    return { text: text.trim(), value: text.trim(), selected: false };
                }
            });
            if (includeAll) {
                options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
            }
            instanceState.options = options;
        },
    },
});
export const customVariableReducer = customVariableSlice.reducer;
export const { createCustomOptionsFromQuery } = customVariableSlice.actions;
//# sourceMappingURL=reducer.js.map