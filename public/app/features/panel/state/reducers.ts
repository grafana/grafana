import { createSlice, Draft, PayloadAction } from '@reduxjs/toolkit';

import { PanelPlugin } from '@grafana/data';
import { AngularComponent } from '@grafana/runtime';

export type RootPanelsState = Record<string, PanelState>;

export interface PanelState {
  plugin?: PanelPlugin;
  angularComponent?: AngularComponent;
  instanceState?: any | null;
}

export const initialState: RootPanelsState = {};

const panelsSlice = createSlice({
  name: 'panels',
  initialState,
  reducers: {
    panelModelAndPluginReady: (state, action: PayloadAction<PanelModelAndPluginReadyPayload>) => {
      if (action.payload.cleanUpKey) {
        cleanUpAngularComponent(state[action.payload.cleanUpKey]);
        delete state[action.payload.cleanUpKey];
      }

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
    removePanels: (state, action: PayloadAction<{ keys: string[] }>) => {
      for (const key of action.payload.keys) {
        delete state[key];
      }
    },
    setPanelInstanceState: (state, action: PayloadAction<SetPanelInstanceStatePayload>) => {
      state[action.payload.key].instanceState = action.payload.value;
    },
    setPanelAngularComponent: (state, action: PayloadAction<SetPanelAngularComponentPayload>) => {
      const panelState = state[action.payload.key];
      cleanUpAngularComponent(panelState);
      panelState.angularComponent = action.payload.angularComponent;
    },
  },
});

export function cleanUpAngularComponent(panelState?: Draft<PanelState>) {
  if (panelState?.angularComponent) {
    panelState.angularComponent.destroy();
  }
}

export interface PanelModelAndPluginReadyPayload {
  key: string;
  plugin: PanelPlugin;
  /** Used to cleanup previous state when we change key (used when switching panel plugin) */
  cleanUpKey?: string;
}

export interface SetPanelAngularComponentPayload {
  key: string;
  angularComponent: AngularComponent;
}

export interface SetPanelInstanceStatePayload {
  key: string;
  value: any;
}

export const {
  panelModelAndPluginReady,
  setPanelAngularComponent,
  setPanelInstanceState,
  changePanelKey,
  removePanel,
  removePanels,
} = panelsSlice.actions;

export const panelsReducer = panelsSlice.reducer;

export default {
  panels: panelsReducer,
};
