import { Plugin, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { LayoutMode } from '../../../core/components/LayoutSelector/LayoutSelector';
import { PluginDashboard } from '../../../types/plugins';

export enum ActionTypes {
  LoadPlugins = 'LOAD_PLUGINS',
  LoadPluginDashboards = 'LOAD_PLUGIN_DASHBOARDS',
  LoadedPluginDashboards = 'LOADED_PLUGIN_DASHBOARDS',
  SetPluginsSearchQuery = 'SET_PLUGIN_SEARCH_QUERY',
  SetLayoutMode = 'SET_LAYOUT_MODE',
}

export interface LoadPluginsAction {
  type: ActionTypes.LoadPlugins;
  payload: Plugin[];
}

export interface LoadPluginDashboardsAction {
  type: ActionTypes.LoadPluginDashboards;
}

export interface LoadedPluginDashboardsAction {
  type: ActionTypes.LoadedPluginDashboards;
  payload: PluginDashboard[];
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

const pluginDashboardsLoad = (): LoadPluginDashboardsAction => ({
  type: ActionTypes.LoadPluginDashboards,
});

const pluginDashboardsLoaded = (dashboards: PluginDashboard[]): LoadedPluginDashboardsAction => ({
  type: ActionTypes.LoadedPluginDashboards,
  payload: dashboards,
});

export type Action =
  | LoadPluginsAction
  | LoadPluginDashboardsAction
  | LoadedPluginDashboardsAction
  | SetPluginsSearchQueryAction
  | SetLayoutModeAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadPlugins(): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().get('api/plugins', { embedded: 0 });
    dispatch(pluginsLoaded(result));
  };
}

export function loadPluginDashboards(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    dispatch(pluginDashboardsLoad());
    const dataSourceType = getStore().dataSources.dataSource.type;
    const response = await getBackendSrv().get(`api/plugins/${dataSourceType}/dashboards`);
    dispatch(pluginDashboardsLoaded(response));
  };
}
