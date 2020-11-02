import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PluginMeta, PanelPlugin, PluginError } from '@grafana/data';
import { PluginsState } from 'app/types';
import { PluginDashboard } from '../../../types/plugins';

export const initialState: PluginsState = {
  plugins: [],
  errors: [],
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
    pluginsErrorsLoaded: (state, action: PayloadAction<PluginError[]>) => {
      state.errors = action.payload;
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
  pluginsErrorsLoaded,
  pluginDashboardsLoad,
  pluginDashboardsLoaded,
  setPluginsSearchQuery,
  panelPluginLoaded,
} = pluginsSlice.actions;

export const pluginsReducer = pluginsSlice.reducer;

export default {
  plugins: pluginsReducer,
};
