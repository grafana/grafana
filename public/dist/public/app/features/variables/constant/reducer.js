import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { initialVariableModelState, VariableHide } from '../types';
import { getInstanceState, initialVariablesState } from '../state/types';
export var initialConstantVariableModelState = __assign(__assign({}, initialVariableModelState), { type: 'constant', hide: VariableHide.hideVariable, query: '', current: {}, options: [] });
export var constantVariableSlice = createSlice({
    name: 'templating/constant',
    initialState: initialVariablesState,
    reducers: {
        createConstantOptionsFromQuery: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            instanceState.options = [
                { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false },
            ];
        },
    },
});
export var constantVariableReducer = constantVariableSlice.reducer;
export var createConstantOptionsFromQuery = constantVariableSlice.actions.createConstantOptionsFromQuery;
//# sourceMappingURL=reducer.js.map