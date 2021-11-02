import { createSlice } from '@reduxjs/toolkit';
export var initialVariableInspectState = {
    unknown: [],
    usages: [],
    unknownsNetwork: [],
    usagesNetwork: [],
    unknownExits: false,
};
var variableInspectReducerSlice = createSlice({
    name: 'templating/inspect',
    initialState: initialVariableInspectState,
    reducers: {
        initInspect: function (state, action) {
            var _a = action.payload, unknown = _a.unknown, usages = _a.usages, unknownExits = _a.unknownExits, unknownsNetwork = _a.unknownsNetwork, usagesNetwork = _a.usagesNetwork;
            state.usages = usages;
            state.unknown = unknown;
            state.unknownsNetwork = unknownsNetwork;
            state.unknownExits = unknownExits;
            state.usagesNetwork = usagesNetwork;
        },
    },
});
export var variableInspectReducer = variableInspectReducerSlice.reducer;
export var initInspect = variableInspectReducerSlice.actions.initInspect;
//# sourceMappingURL=reducer.js.map