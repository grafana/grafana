import { Action, ActionTypes } from './actions';
import { Plugin, PluginsState } from 'app/types';

export const initialState: PluginsState = { plugins: [] as Plugin[] };

export const pluginsReducer = (state = initialState, action: Action): PluginsState => {
  switch (action.type) {
    case ActionTypes.LoadPlugins:
      return { ...state, plugins: action.payload };
  }
  return state;
};

export default {
  plugins: pluginsReducer,
};
