import { Unsubscribable } from 'rxjs';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PanelModel } from '../../../state/PanelModel';
import { PanelData, LoadingState, DefaultTimeRange } from '@grafana/data';
import { DisplayMode } from '../types';
import store from '../../../../../core/store';

export const PANEL_EDITOR_UI_STATE_STORAGE_KEY = 'grafana.dashboard.editor.ui';

export const DEFAULT_PANEL_EDITOR_UI_STATE: PanelEditorUIState = {
  isPanelOptionsVisible: true,
  rightPaneSize: 350,
  topPaneSize: '45%',
  mode: DisplayMode.Fill,
};

export interface PanelEditorUIState {
  /* Visualization options pane visibility */
  isPanelOptionsVisible: boolean;
  /* Pixels or percentage */
  rightPaneSize: number | string;
  /* Pixels or percentage */
  topPaneSize: number | string;
  /* Visualization size mode */
  mode: DisplayMode;
}

export interface PanelEditorStateNew {
  /* These are functions as they are mutaded later on and redux toolkit will Object.freeze state so
   * we need to store these using functions instead */
  getSourcePanel: () => PanelModel;
  getPanel: () => PanelModel;
  getData: () => PanelData;
  querySubscription?: Unsubscribable;
  initDone: boolean;
  shouldDiscardChanges: boolean;
  isOpen: boolean;
  ui: PanelEditorUIState;
}

export const initialState: PanelEditorStateNew = {
  getPanel: () => new PanelModel({}),
  getSourcePanel: () => new PanelModel({}),
  getData: () => ({
    state: LoadingState.NotStarted,
    series: [],
    timeRange: DefaultTimeRange,
  }),
  initDone: false,
  shouldDiscardChanges: false,
  isOpen: false,
  ui: {
    ...DEFAULT_PANEL_EDITOR_UI_STATE,
    ...store.getObject(PANEL_EDITOR_UI_STATE_STORAGE_KEY, DEFAULT_PANEL_EDITOR_UI_STATE),
  },
};

interface InitEditorPayload {
  panel: PanelModel;
  sourcePanel: PanelModel;
  querySubscription: Unsubscribable;
}

const pluginsSlice = createSlice({
  name: 'panelEditorNew',
  initialState,
  reducers: {
    updateEditorInitState: (state, action: PayloadAction<InitEditorPayload>) => {
      state.getPanel = () => action.payload.panel;
      state.getSourcePanel = () => action.payload.sourcePanel;
      state.querySubscription = action.payload.querySubscription;
      state.initDone = true;
      state.isOpen = true;
    },
    setEditorPanelData: (state, action: PayloadAction<PanelData>) => {
      state.getData = () => action.payload;
    },
    setDiscardChanges: (state, action: PayloadAction<boolean>) => {
      state.shouldDiscardChanges = action.payload;
    },
    setPanelEditorUIState: (state, action: PayloadAction<Partial<PanelEditorUIState>>) => {
      state.ui = { ...state.ui, ...action.payload };
    },
    closeCompleted: state => {
      state.isOpen = false;
      state.initDone = false;
    },
  },
});

export const {
  updateEditorInitState,
  setEditorPanelData,
  setDiscardChanges,
  closeCompleted,
  setPanelEditorUIState,
} = pluginsSlice.actions;

export const panelEditorReducerNew = pluginsSlice.reducer;
