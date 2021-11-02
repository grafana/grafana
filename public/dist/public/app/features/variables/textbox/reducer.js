import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { initialVariableModelState } from '../types';
import { getInstanceState, initialVariablesState } from '../state/types';
export var initialTextBoxVariableModelState = __assign(__assign({}, initialVariableModelState), { type: 'textbox', query: '', current: {}, options: [], originalQuery: null });
export var textBoxVariableSlice = createSlice({
    name: 'templating/textbox',
    initialState: initialVariablesState,
    reducers: {
        createTextBoxOptions: function (state, action) {
            var instanceState = getInstanceState(state, action.payload.id);
            var option = { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false };
            instanceState.options = [option];
            instanceState.current = option;
        },
    },
});
export var textBoxVariableReducer = textBoxVariableSlice.reducer;
export var createTextBoxOptions = textBoxVariableSlice.actions.createTextBoxOptions;
//# sourceMappingURL=reducer.js.map