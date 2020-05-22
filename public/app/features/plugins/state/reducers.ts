import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PluginMeta, PanelPlugin } from '@grafana/data';
import { PluginsState } from 'app/types';
import { PluginDashboard } from '../../../types/plugins';

export const initialState: PluginsState = {
  plugins: [],
  searchQuery: '',
  hasFetched: false,
  dashboards: [],
  isLoadingPluginDashboards: false,
  panels: {},
};

const pluginsSlice = createSlice({
  name: 'plugins',
  initialState,
  reducers: {
    pluginsLoaded: (state, action: PayloadAction<PluginMeta[]>) => {
      state.hasFetched = true;
      state.plugins = action.payload;
    },
    setPluginsSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    pluginDashboardsLoad: (state, action: PayloadAction<undefined>) => {
      state.isLoadingPluginDashboards = true;
      state.dashboards = [];
    },
    pluginDashboardsLoaded: (state, action: PayloadAction<PluginDashboard[]>) => {
      state.isLoadingPluginDashboards = false;
      state.dashboards = action.payload;
    },
    panelPluginLoaded: (state, action: PayloadAction<PanelPlugin>) => {
      state.panels[action.payload.meta!.id] = action.payload;
    },
  },
});

export const {
  pluginsLoaded,
  pluginDashboardsLoad,
  pluginDashboardsLoaded,
  setPluginsSearchQuery,
  panelPluginLoaded,
} = pluginsSlice.actions;

export const pluginsReducer = pluginsSlice.reducer;

export default {
  plugins: pluginsReducer,
};
