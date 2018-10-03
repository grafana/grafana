import { Plugin, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { LayoutMode } from '../../../core/components/LayoutSelector/LayoutSelector';

export enum ActionTypes {
  LoadPlugins = 'LOAD_PLUGINS',
  SetPluginsSearchQuery = 'SET_PLUGIN_SEARCH_QUERY',
  SetLayoutMode = 'SET_LAYOUT_MODE',
}

export interface LoadPluginsAction {
  type: ActionTypes.LoadPlugins;
  payload: Plugin[];
}

export interface SetPluginsSearchQueryAction {
  type: ActionTypes.SetPluginsSearchQuery;
  payload: string;
}

export interface SetLayoutModeAction {
  type: ActionTypes.SetLayoutMode;
  payload: LayoutMode;
}

export const setPluginsLayoutMode = (mode: LayoutMode): SetLayoutModeAction => ({
  type: ActionTypes.SetLayoutMode,
  payload: mode,
});

export const setPluginsSearchQuery = (query: string): SetPluginsSearchQueryAction => ({
  type: ActionTypes.SetPluginsSearchQuery,
  payload: query,
});

const pluginsLoaded = (plugins: Plugin[]): LoadPluginsAction => ({
  type: ActionTypes.LoadPlugins,
  payload: plugins,
});

export type Action = LoadPluginsAction | SetPluginsSearchQueryAction | SetLayoutModeAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadPlugins(): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().get('api/plugins', { embedded: 0 });
    dispatch(pluginsLoaded(result));
  };
}
