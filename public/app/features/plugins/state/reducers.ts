import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PluginMeta } from '@grafana/data';
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
};

const pluginsSlice = createSlice({
  name: 'plugins',
  initialState,
  reducers: {
    pluginsLoaded: (state, action: PayloadAction<PluginMeta[]>): PluginsState => {
      return { ...state, hasFetched: true, plugins: action.payload };
    },
    setPluginsSearchQuery: (state, action: PayloadAction<string>): PluginsState => {
      return { ...state, searchQuery: action.payload };
    },
    setPluginsLayoutMode: (state, action: PayloadAction<LayoutMode>): PluginsState => {
      return { ...state, layoutMode: action.payload };
    },
    pluginDashboardsLoad: (state, action: PayloadAction<undefined>): PluginsState => {
      return { ...state, dashboards: [], isLoadingPluginDashboards: true };
    },
    pluginDashboardsLoaded: (state, action: PayloadAction<PluginDashboard[]>): PluginsState => {
      return { ...state, dashboards: action.payload, isLoadingPluginDashboards: false };
    },
  },
});

export const {
  pluginsLoaded,
  pluginDashboardsLoad,
  pluginDashboardsLoaded,
  setPluginsLayoutMode,
  setPluginsSearchQuery,
} = pluginsSlice.actions;

export const pluginsReducer = pluginsSlice.reducer;

export default {
  plugins: pluginsReducer,
};
