import { Action, ActionTypes } from './actions';
import { Plugin, PluginsState } from 'app/types';
import { LayoutModes } from '../../../core/components/LayoutSelector/LayoutSelector';

export const initialState: PluginsState = {
  plugins: [] as Plugin[],
  searchQuery: '',
  layoutMode: LayoutModes.Grid,
};

export const pluginsReducer = (state = initialState, action: Action): PluginsState => {
  switch (action.type) {
    case ActionTypes.LoadPlugins:
      return { ...state, plugins: action.payload };

    case ActionTypes.SetPluginsSearchQuery:
      return { ...state, searchQuery: action.payload };

    case ActionTypes.SetLayoutMode:
      return { ...state, layoutMode: action.payload };
  }
  return state;
};

export default {
  plugins: pluginsReducer,
};
