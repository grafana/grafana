import { Action, ActionTypes } from './actions';
import { Plugin, PluginsState } from 'app/types';
import { LayoutModes } from '../../../core/components/LayoutSelector/LayoutSelector';
import { PluginDashboard } from '../../../types/plugins';

export const initialState: PluginsState = {
  plugins: [] as Plugin[],
  searchQuery: '',
  layoutMode: LayoutModes.Grid,
  hasFetched: false,
  dashboards: [] as PluginDashboard[],
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
      return { ...state, dashboards: action.payload };
  }
  return state;
};

export default {
  plugins: pluginsReducer,
};
