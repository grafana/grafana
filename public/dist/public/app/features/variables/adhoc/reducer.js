var _a;
import { __assign } from "tslib";
import { initialVariableModelState } from 'app/features/variables/types';
import { getInstanceState, initialVariablesState } from '../state/types';
import { createSlice } from '@reduxjs/toolkit';
export var initialAdHocVariableModelState = __assign(__assign({}, initialVariableModelState), { type: 'adhoc', datasource: null, filters: [] });
export var adHocVariableSlice = createSlice({
    name: 'templating/adhoc',
    initialState: initialVariablesState,
    reducers: {
        filterAdded: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            instanceState.filters.push(action.payload.data);
        },
        filterRemoved: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            var index = action.payload.data;
            instanceState.filters.splice(index, 1);
        },
        filterUpdated: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            var _a = action.payload.data, filter = _a.filter, index = _a.index;
            instanceState.filters[index] = filter;
        },
        filtersRestored: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            instanceState.filters = action.payload.data;
        },
    },
});
export var filterAdded = (_a = adHocVariableSlice.actions, _a.filterAdded), filterRemoved = _a.filterRemoved, filterUpdated = _a.filterUpdated, filtersRestored = _a.filtersRestored;
export var adHocVariableReducer = adHocVariableSlice.reducer;
//# sourceMappingURL=reducer.js.map