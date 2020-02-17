import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PluginMeta, PanelPlugin } from '@grafana/data';
import { PluginsState } from 'app/types';
import { LayoutMode, LayoutModes } from '../../../core/components/LayoutSelector/LayoutSelector';
import { PluginDashboard } from '../../../types/plugins';

export const initialState: PluginsState = {
  plugins: [],
  searchQuery: '',
  layoutMode: LayoutModes.Grid,
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
    setPluginsLayoutMode: (state, action: PayloadAction<LayoutMode>) => {
      state.layoutMode = action.payload;
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
  setPluginsLayoutMode,
  setPluginsSearchQuery,
  panelPluginLoaded,
} = pluginsSlice.actions;

export const pluginsReducer = pluginsSlice.reducer;

export default {
  plugins: pluginsReducer,
};
