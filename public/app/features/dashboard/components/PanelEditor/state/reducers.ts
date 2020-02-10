import { Unsubscribable } from 'rxjs';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PanelModel } from '../../../state/PanelModel';
import { PanelData, LoadingState, DefaultTimeRange } from '@grafana/data';
import { DisplayMode } from '../types';

export interface PanelEditorStateNew {
  getSourcePanel: () => PanelModel;
  getPanel: () => PanelModel;
  data: PanelData;
  mode: DisplayMode;
  isPanelOptionsVisible: boolean;
  querySubscription?: Unsubscribable;
  initDone: boolean;
}

export const initialState: PanelEditorStateNew = {
  getPanel: () => new PanelModel({}),
  getSourcePanel: () => new PanelModel({}),
  data: {
    state: LoadingState.NotStarted,
    series: [],
    timeRange: DefaultTimeRange,
  },
  isPanelOptionsVisible: true,
  mode: DisplayMode.Fill,
  initDone: false,
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
    },
    setEditorPanelData: (state, action: PayloadAction<PanelData>) => {
      state.data = action.payload;
    },
  },
});

export const { updateEditorInitState, setEditorPanelData } = pluginsSlice.actions;

export const panelEditorReducerNew = pluginsSlice.reducer;
