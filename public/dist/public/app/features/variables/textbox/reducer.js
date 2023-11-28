import { createSlice } from '@reduxjs/toolkit';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState } from '../state/types';
import { initialVariableModelState } from '../types';
export const initialTextBoxVariableModelState = Object.assign(Object.assign({}, initialVariableModelState), { type: 'textbox', query: '', current: {}, options: [], originalQuery: null });
export const textBoxVariableSlice = createSlice({
    name: 'templating/textbox',
    initialState: initialVariablesState,
    reducers: {
        createTextBoxOptions: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'textbox') {
                return;
            }
            const option = { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false };
            instanceState.options = [option];
            instanceState.current = option;
        },
    },
});
export const textBoxVariableReducer = textBoxVariableSlice.reducer;
export const { createTextBoxOptions } = textBoxVariableSlice.actions;
//# sourceMappingURL=reducer.js.map