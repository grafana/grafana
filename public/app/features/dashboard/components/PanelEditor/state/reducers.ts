import { Unsubscribable } from 'rxjs';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PanelModel } from '../../../state/PanelModel';
import { PanelData, LoadingState, DefaultTimeRange } from '@grafana/data';
import { DisplayMode } from '../types';

export interface PanelEditorStateNew {
  /* These are functions as they are mutaded later on and redux toolkit will Object.freeze state so
   * we need to store these using functions instead */
  getSourcePanel: () => PanelModel;
  getPanel: () => PanelModel;
  getData: () => PanelData;
  mode: DisplayMode;
  isPanelOptionsVisible: boolean;
  querySubscription?: Unsubscribable;
  initDone: boolean;
  shouldDiscardChanges: boolean;
  isOpen: boolean;
}

export const initialState: PanelEditorStateNew = {
  getPanel: () => new PanelModel({}),
  getSourcePanel: () => new PanelModel({}),
  getData: () => ({
    state: LoadingState.NotStarted,
    series: [],
    timeRange: DefaultTimeRange,
  }),
  isPanelOptionsVisible: true,
  mode: DisplayMode.Fill,
  initDone: false,
  shouldDiscardChanges: false,
  isOpen: false,
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
    toggleOptionsView: state => {
      state.isPanelOptionsVisible = !state.isPanelOptionsVisible;
    },
    setDisplayMode: (state, action: PayloadAction<DisplayMode>) => {
      state.mode = action.payload;
    },
    setDiscardChanges: (state, action: PayloadAction<boolean>) => {
      state.shouldDiscardChanges = action.payload;
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
  toggleOptionsView,
  setDisplayMode,
  setDiscardChanges,
  closeCompleted,
} = pluginsSlice.actions;

export const panelEditorReducerNew = pluginsSlice.reducer;
