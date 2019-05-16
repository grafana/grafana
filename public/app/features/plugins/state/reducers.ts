import { Action, ActionTypes } from './actions';
import { PluginsState } from 'app/types';
import { LayoutModes } from '../../../core/components/LayoutSelector/LayoutSelector';
import { PluginDashboard } from '../../../types/plugins';
import { PluginMeta } from '@grafana/ui';

export const initialState: PluginsState = {
  plugins: [] as PluginMeta[],
  searchQuery: '',
  layoutMode: LayoutModes.Grid,
  hasFetched: false,
  dashboards: [] as PluginDashboard[],
  isLoadingPluginDashboards: false,
};

export const pluginsReducer = (state = initialState, action: Action): PluginsState => {
  switch (action.type) {
    case ActionTypes.LoadPlugins:
      return { ...state, hasFetched: true, plugins: action.payload };

    case ActionTypes.SetPluginsSearchQuery:
      return { ...state, searchQuery: action.payload };

    case ActionTypes.SetLayoutMode:
      return { ...state, layoutMode: action.payload };

    case ActionTypes.LoadPluginDashboards:
      return { ...state, dashboards: [], isLoadingPluginDashboards: true };

    case ActionTypes.LoadedPluginDashboards:
      return { ...state, dashboards: action.payload, isLoadingPluginDashboards: false };
  }
  return state;
};

export default {
  plugins: pluginsReducer,
};
