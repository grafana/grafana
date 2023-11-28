import { createSlice } from '@reduxjs/toolkit';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import store from '../../../../../core/store';
import { PanelModel } from '../../../state/PanelModel';
import { DisplayMode } from '../types';
export const PANEL_EDITOR_UI_STATE_STORAGE_KEY = 'grafana.dashboard.editor.ui';
export const DEFAULT_PANEL_EDITOR_UI_STATE = {
    isPanelOptionsVisible: true,
    rightPaneSize: 400,
    topPaneSize: 0.45,
    mode: DisplayMode.Fill,
};
export const initialState = () => {
    const storedUiState = store.getObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, DEFAULT_PANEL_EDITOR_UI_STATE);
    let migratedState = Object.assign({}, storedUiState);
    if (typeof storedUiState.topPaneSize === 'string') {
        migratedState = Object.assign(Object.assign({}, storedUiState), { topPaneSize: parseFloat(storedUiState.topPaneSize) / 100 });
    }
    return {
        getPanel: () => new PanelModel({}),
        getSourcePanel: () => new PanelModel({}),
        getData: () => ({
            state: LoadingState.NotStarted,
            series: [],
            timeRange: getDefaultTimeRange(),
        }),
        initDone: false,
        shouldDiscardChanges: false,
        isOpen: false,
        isVizPickerOpen: false,
        tableViewEnabled: false,
        ui: Object.assign(Object.assign({}, DEFAULT_PANEL_EDITOR_UI_STATE), migratedState),
    };
};
const pluginsSlice = createSlice({
    name: 'panelEditor',
    initialState: initialState(),
    reducers: {
        updateEditorInitState: (state, action) => {
            state.getPanel = () => action.payload.panel;
            state.getSourcePanel = () => action.payload.sourcePanel;
            state.initDone = true;
            state.isOpen = true;
            state.shouldDiscardChanges = false;
        },
        setEditorPanelData: (state, action) => {
            state.getData = () => action.payload;
        },
        setDiscardChanges: (state, action) => {
            state.shouldDiscardChanges = action.payload;
        },
        setPanelEditorUIState: (state, action) => {
            state.ui = Object.assign(Object.assign({}, state.ui), action.payload);
            // Close viz picker if closing options pane
            if (!state.ui.isPanelOptionsVisible && state.isVizPickerOpen) {
                state.isVizPickerOpen = false;
            }
        },
        toggleVizPicker: (state, action) => {
            state.isVizPickerOpen = action.payload;
            // Ensure options pane is opened when viz picker is open
            if (state.isVizPickerOpen) {
                state.ui.isPanelOptionsVisible = true;
            }
        },
        toggleTableView(state) {
            state.tableViewEnabled = !state.tableViewEnabled;
        },
        closeEditor: (state) => {
            state.getPanel = () => new PanelModel({});
            state.getSourcePanel = () => new PanelModel({});
            state.isOpen = false;
            state.initDone = false;
            state.isVizPickerOpen = false;
            state.tableViewEnabled = false;
        },
    },
});
export const { updateEditorInitState, setEditorPanelData, setDiscardChanges, closeEditor, setPanelEditorUIState, toggleVizPicker, toggleTableView, } = pluginsSlice.actions;
export const panelEditorReducer = pluginsSlice.reducer;
export default {
    panelEditor: panelEditorReducer,
};
//# sourceMappingURL=reducers.js.map