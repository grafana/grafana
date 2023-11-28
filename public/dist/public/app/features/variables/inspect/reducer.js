import { createSlice } from '@reduxjs/toolkit';
export const initialVariableInspectState = {
    usages: [],
    usagesNetwork: [],
};
const variableInspectReducerSlice = createSlice({
    name: 'templating/inspect',
    initialState: initialVariableInspectState,
    reducers: {
        initInspect: (state, action) => {
            const { usages, usagesNetwork } = action.payload;
            state.usages = usages;
            state.usagesNetwork = usagesNetwork;
        },
    },
});
export const variableInspectReducer = variableInspectReducerSlice.reducer;
export const { initInspect } = variableInspectReducerSlice.actions;
//# sourceMappingURL=reducer.js.map