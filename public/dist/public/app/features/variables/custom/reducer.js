import { __assign, __read } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { initialVariableModelState } from '../types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, getInstanceState, initialVariablesState, } from '../state/types';
export var initialCustomVariableModelState = __assign(__assign({}, initialVariableModelState), { type: 'custom', multi: false, includeAll: false, allValue: null, query: '', options: [], current: {} });
export var customVariableSlice = createSlice({
    name: 'templating/custom',
    initialState: initialVariablesState,
    reducers: {
        createCustomOptionsFromQuery: function (state, action) {
            var _a;
            var instanceState = getInstanceState(state, action.payload.id);
            var includeAll = instanceState.includeAll, query = instanceState.query;
            var match = (_a = query.match(/(?:\\,|[^,])+/g)) !== null && _a !== void 0 ? _a : [];
            var options = match.map(function (text) {
                var _a;
                text = text.replace(/\\,/g, ',');
                var textMatch = (_a = /^(.+)\s:\s(.+)$/g.exec(text)) !== null && _a !== void 0 ? _a : [];
                if (textMatch.length === 3) {
                    var _b = __read(textMatch, 3), key = _b[1], value = _b[2];
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
export var customVariableReducer = customVariableSlice.reducer;
export var createCustomOptionsFromQuery = customVariableSlice.actions.createCustomOptionsFromQuery;
//# sourceMappingURL=reducer.js.map