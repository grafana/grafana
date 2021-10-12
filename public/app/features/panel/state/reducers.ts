import { createSlice, Draft, PayloadAction } from '@reduxjs/toolkit';
import { AngularComponent } from '@grafana/runtime';
import { PanelPlugin, VisualizationSuggestion } from '@grafana/data';

export type RootPanelsState = Record<string, PanelState>;

export interface PanelState {
  plugin?: PanelPlugin;
  angularComponent?: AngularComponent;
  instanceState?: any | null;
  suggestions?: VisualizationSuggestion[];
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
    cleanUpPanelState: (state, action: PayloadAction<{ key: string }>) => {
      cleanUpAngularComponent(state[action.payload.key]);
      delete state[action.payload.key];
    },
    setPanelInstanceState: (state, action: PayloadAction<SetPanelInstanceStatePayload>) => {
      state[action.payload.key].instanceState = action.payload.value;
    },
    setPanelSuggestions: (state, action: PayloadAction<{ key: string; suggestions: VisualizationSuggestion[] }>) => {
      state[action.payload.key].suggestions = action.payload.suggestions;
    },
    setPanelAngularComponent: (state, action: PayloadAction<SetPanelAngularComponentPayload>) => {
      const panelState = state[action.payload.key];
      cleanUpAngularComponent(panelState);
      panelState.angularComponent = action.payload.angularComponent;
    },
  },
});

function cleanUpAngularComponent(panelState?: Draft<PanelState>) {
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
  setPanelSuggestions,
  cleanUpPanelState,
} = panelsSlice.actions;

export const panelsReducer = panelsSlice.reducer;

export default {
  panels: panelsReducer,
};
