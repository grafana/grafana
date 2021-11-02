var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { PanelModel } from '../../../state/PanelModel';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { DisplayMode } from '../types';
import store from '../../../../../core/store';
export var PANEL_EDITOR_UI_STATE_STORAGE_KEY = 'grafana.dashboard.editor.ui';
export var DEFAULT_PANEL_EDITOR_UI_STATE = {
    isPanelOptionsVisible: true,
    rightPaneSize: 400,
    topPaneSize: 0.45,
    mode: DisplayMode.Fill,
};
export var initialState = function () {
    var storedUiState = store.getObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, DEFAULT_PANEL_EDITOR_UI_STATE);
    var migratedState = __assign({}, storedUiState);
    if (typeof storedUiState.topPaneSize === 'string') {
        migratedState = __assign(__assign({}, storedUiState), { topPaneSize: parseFloat(storedUiState.topPaneSize) / 100 });
    }
    return {
        getPanel: function () { return new PanelModel({}); },
        getSourcePanel: function () { return new PanelModel({}); },
        getData: function () { return ({
            state: LoadingState.NotStarted,
            series: [],
            timeRange: getDefaultTimeRange(),
        }); },
        initDone: false,
        shouldDiscardChanges: false,
        isOpen: false,
        isVizPickerOpen: false,
        tableViewEnabled: false,
        ui: __assign(__assign({}, DEFAULT_PANEL_EDITOR_UI_STATE), migratedState),
    };
};
var pluginsSlice = createSlice({
    name: 'panelEditor',
    initialState: initialState(),
    reducers: {
        updateEditorInitState: function (state, action) {
            state.getPanel = function () { return action.payload.panel; };
            state.getSourcePanel = function () { return action.payload.sourcePanel; };
            state.initDone = true;
            state.isOpen = true;
            state.shouldDiscardChanges = false;
        },
        setEditorPanelData: function (state, action) {
            state.getData = function () { return action.payload; };
        },
        setDiscardChanges: function (state, action) {
            state.shouldDiscardChanges = action.payload;
        },
        setPanelEditorUIState: function (state, action) {
            state.ui = __assign(__assign({}, state.ui), action.payload);
            // Close viz picker if closing options pane
            if (!state.ui.isPanelOptionsVisible && state.isVizPickerOpen) {
                state.isVizPickerOpen = false;
            }
        },
        toggleVizPicker: function (state, action) {
            state.isVizPickerOpen = action.payload;
            // Ensure options pane is opened when viz picker is open
            if (state.isVizPickerOpen) {
                state.ui.isPanelOptionsVisible = true;
            }
        },
        toggleTableView: function (state) {
            state.tableViewEnabled = !state.tableViewEnabled;
        },
        closeEditor: function (state) {
            state.isOpen = false;
            state.initDone = false;
            state.isVizPickerOpen = false;
            state.tableViewEnabled = false;
        },
    },
});
export var updateEditorInitState = (_a = pluginsSlice.actions, _a.updateEditorInitState), setEditorPanelData = _a.setEditorPanelData, setDiscardChanges = _a.setDiscardChanges, closeEditor = _a.closeEditor, setPanelEditorUIState = _a.setPanelEditorUIState, toggleVizPicker = _a.toggleVizPicker, toggleTableView = _a.toggleTableView;
export var panelEditorReducer = pluginsSlice.reducer;
export default {
    panelEditor: panelEditorReducer,
};
//# sourceMappingURL=reducers.js.map