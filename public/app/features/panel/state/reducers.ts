import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AngularComponent } from '@grafana/runtime';
import { PanelPlugin } from '@grafana/data';

export type RootPanelsState = Record<string, PanelState>;

export interface PanelState {
  plugin?: PanelPlugin;
  angularComponent?: AngularComponent | null;
  instanceState?: any | null;
}

export const initialState: RootPanelsState = {};

const panelsSlice = createSlice({
  name: 'panels',
  initialState,
  reducers: {
    panelModelAndPluginReady: (state, action: PayloadAction<PanelModelAndPluginReadyPayload>) => {
      state[action.payload.key] = {
        plugin: action.payload.plugin,
      };
    },
    cleanUpPanelState: (state, action: PayloadAction<{ key: string }>) => {
      delete state[action.payload.key];
    },
    setPanelInstanceState: (state, action: PayloadAction<SetPanelInstanceStatePayload>) => {
      state[action.payload.key].instanceState = action.payload.value;
    },
    setPanelAngularComponent: (state, action: PayloadAction<SetPanelAngularComponentPayload>) => {
      state[action.payload.key].angularComponent = action.payload.angularComponent;
    },
  },
});

export interface PanelModelAndPluginReadyPayload {
  key: string;
  plugin: PanelPlugin;
}

export interface SetPanelAngularComponentPayload {
  key: string;
  angularComponent: AngularComponent | null;
}

export interface SetPanelInstanceStatePayload {
  key: string;
  value: any;
}

export const {
  panelModelAndPluginReady,
  setPanelAngularComponent,
  setPanelInstanceState,
  cleanUpPanelState,
} = panelsSlice.actions;

export const panelsReducer = panelsSlice.reducer;

export default {
  panels: panelsReducer,
};
