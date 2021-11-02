var _a;
import { createSlice } from '@reduxjs/toolkit';
export var initialState = {};
var panelsSlice = createSlice({
    name: 'panels',
    initialState: initialState,
    reducers: {
        panelModelAndPluginReady: function (state, action) {
            if (action.payload.cleanUpKey) {
                cleanUpAngularComponent(state[action.payload.cleanUpKey]);
                delete state[action.payload.cleanUpKey];
            }
            state[action.payload.key] = {
                plugin: action.payload.plugin,
            };
        },
        cleanUpPanelState: function (state, action) {
            cleanUpAngularComponent(state[action.payload.key]);
            delete state[action.payload.key];
        },
        setPanelInstanceState: function (state, action) {
            state[action.payload.key].instanceState = action.payload.value;
        },
        setPanelAngularComponent: function (state, action) {
            var panelState = state[action.payload.key];
            cleanUpAngularComponent(panelState);
            panelState.angularComponent = action.payload.angularComponent;
        },
    },
});
function cleanUpAngularComponent(panelState) {
    if (panelState === null || panelState === void 0 ? void 0 : panelState.angularComponent) {
        panelState.angularComponent.destroy();
    }
}
export var panelModelAndPluginReady = (_a = panelsSlice.actions, _a.panelModelAndPluginReady), setPanelAngularComponent = _a.setPanelAngularComponent, setPanelInstanceState = _a.setPanelInstanceState, cleanUpPanelState = _a.cleanUpPanelState;
export var panelsReducer = panelsSlice.reducer;
export default {
    panels: panelsReducer,
};
//# sourceMappingURL=reducers.js.map