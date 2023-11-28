import { createSlice } from '@reduxjs/toolkit';
export const initialState = {};
const panelsSlice = createSlice({
    name: 'panels',
    initialState,
    reducers: {
        panelModelAndPluginReady: (state, action) => {
            state[action.payload.key] = {
                plugin: action.payload.plugin,
            };
        },
        changePanelKey: (state, action) => {
            state[action.payload.newKey] = state[action.payload.oldKey];
            delete state[action.payload.oldKey];
        },
        removePanel: (state, action) => {
            delete state[action.payload.key];
        },
        removeAllPanels: (state) => {
            Object.keys(state).forEach((key) => delete state[key]);
        },
        setPanelInstanceState: (state, action) => {
            state[action.payload.key].instanceState = action.payload.value;
        },
        setPanelAngularComponent: (state, action) => {
            const panelState = state[action.payload.key];
            panelState.angularComponent = action.payload.angularComponent;
        },
    },
});
export const { panelModelAndPluginReady, setPanelAngularComponent, setPanelInstanceState, changePanelKey, removePanel, removeAllPanels, } = panelsSlice.actions;
export const panelsReducer = panelsSlice.reducer;
export default {
    panels: panelsReducer,
};
//# sourceMappingURL=reducers.js.map