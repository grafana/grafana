import { createSlice } from '@reduxjs/toolkit';
import { getInstanceState } from '../state/selectors';
import { initialVariablesState } from '../state/types';
import { initialVariableModelState, VariableHide } from '../types';
export const initialConstantVariableModelState = Object.assign(Object.assign({}, initialVariableModelState), { type: 'constant', hide: VariableHide.hideVariable, query: '', current: {}, options: [] });
export const constantVariableSlice = createSlice({
    name: 'templating/constant',
    initialState: initialVariablesState,
    reducers: {
        createConstantOptionsFromQuery: (state, action) => {
            const instanceState = getInstanceState(state, action.payload.id);
            if (instanceState.type !== 'constant') {
                return;
            }
            instanceState.options = [
                { text: instanceState.query.trim(), value: instanceState.query.trim(), selected: false },
            ];
        },
    },
});
export const constantVariableReducer = constantVariableSlice.reducer;
export const { createConstantOptionsFromQuery } = constantVariableSlice.actions;
//# sourceMappingURL=reducer.js.map