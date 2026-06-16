import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { type PanelPlugin } from '@grafana/data';

type RootPanelsState = Record<string, PanelState>;

interface PanelState {
  plugin?: PanelPlugin;
}

const initialState: RootPanelsState = {};

const panelsSlice = createSlice({
  name: 'panels',
  initialState,
  reducers: {
    panelModelAndPluginReady: (state, action: PayloadAction<PanelModelAndPluginReadyPayload>) => {
      state[action.payload.key] = {
        plugin: action.payload.plugin,
      };
    },
    changePanelKey: (state, action: PayloadAction<{ oldKey: string; newKey: string }>) => {
      state[action.payload.newKey] = state[action.payload.oldKey];
      delete state[action.payload.oldKey];
    },
    removePanel: (state, action: PayloadAction<{ key: string }>) => {
      delete state[action.payload.key];
    },
    removeAllPanels: (state) => {
      Object.keys(state).forEach((key) => delete state[key]);
    },
  },
});

interface PanelModelAndPluginReadyPayload {
  key: string;
  plugin: PanelPlugin;
}

export const { panelModelAndPluginReady, removePanel, removeAllPanels } = panelsSlice.actions;

const panelsReducer = panelsSlice.reducer;

export default {
  panels: panelsReducer,
};
