import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { getDefaultTimeRange, LoadingState, PanelData } from '@grafana/data';

import store from '../../../../../core/store';
import { PanelModel } from '../../../state/PanelModel';
import { DisplayMode } from '../types';

export const PANEL_EDITOR_UI_STATE_STORAGE_KEY = 'grafana.dashboard.editor.ui';

export const DEFAULT_PANEL_EDITOR_UI_STATE: PanelEditorUIState = {
  isPanelOptionsVisible: true,
  rightPaneSize: 400,
  topPaneSize: 0.45,
  mode: DisplayMode.Fill,
};

export interface PanelEditorUIState {
  /* Visualization options pane visibility */
  isPanelOptionsVisible: boolean;
  /* Pixels or percentage */
  rightPaneSize: number;
  /* Pixels or percentage */
  topPaneSize: number;
  /* Visualization size mode */
  mode: DisplayMode;
}

export interface PanelEditorState {
  /* These are functions as they are mutated later on and redux toolkit will Object.freeze state so
   * we need to store these using functions instead */
  getSourcePanel: () => PanelModel;
  getPanel: () => PanelModel;
  getData: () => PanelData;
  initDone: boolean;
  shouldDiscardChanges: boolean;
  isOpen: boolean;
  ui: PanelEditorUIState;
  isVizPickerOpen: boolean;
  tableViewEnabled: boolean;
}

export const initialState = (): PanelEditorState => {
  const storedUiState = store.getObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, DEFAULT_PANEL_EDITOR_UI_STATE);

  let migratedState = { ...storedUiState };

  if (typeof storedUiState.topPaneSize === 'string') {
    migratedState = { ...storedUiState, topPaneSize: parseFloat(storedUiState.topPaneSize) / 100 };
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
    ui: {
      ...DEFAULT_PANEL_EDITOR_UI_STATE,
      ...migratedState,
    },
  };
};

interface InitEditorPayload {
  panel: PanelModel;
  sourcePanel: PanelModel;
}

const pluginsSlice = createSlice({
  name: 'panelEditor',
  initialState: initialState(),
  reducers: {
    updateEditorInitState: (state, action: PayloadAction<InitEditorPayload>) => {
      state.getPanel = () => action.payload.panel;
      state.getSourcePanel = () => action.payload.sourcePanel;
      state.initDone = true;
      state.isOpen = true;
      state.shouldDiscardChanges = false;
    },
    setEditorPanelData: (state, action: PayloadAction<PanelData>) => {
      state.getData = () => action.payload;
    },
    setDiscardChanges: (state, action: PayloadAction<boolean>) => {
      state.shouldDiscardChanges = action.payload;
    },
    setPanelEditorUIState: (state, action: PayloadAction<Partial<PanelEditorUIState>>) => {
      state.ui = { ...state.ui, ...action.payload };
      // Close viz picker if closing options pane
      if (!state.ui.isPanelOptionsVisible && state.isVizPickerOpen) {
        state.isVizPickerOpen = false;
      }
    },
    toggleVizPicker: (state, action: PayloadAction<boolean>) => {
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
      state.isOpen = false;
      state.initDone = false;
      state.isVizPickerOpen = false;
      state.tableViewEnabled = false;
    },
  },
});

export const {
  updateEditorInitState,
  setEditorPanelData,
  setDiscardChanges,
  closeEditor,
  setPanelEditorUIState,
  toggleVizPicker,
  toggleTableView,
} = pluginsSlice.actions;

export const panelEditorReducer = pluginsSlice.reducer;

export default {
  panelEditor: panelEditorReducer,
};
