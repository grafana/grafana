import { ThunkAction } from 'redux-thunk';
import { DataSource, DataSourcePermissionDTO, Plugin, StoreState } from 'app/types';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { LayoutMode } from '../../../core/components/LayoutSelector/LayoutSelector';
import { updateLocation, updateNavIndex, UpdateNavIndexAction } from '../../../core/actions';
import { UpdateLocationAction } from '../../../core/actions/location';
import { buildNavModel } from './navModel';

export enum ActionTypes {
  LoadDataSources = 'LOAD_DATA_SOURCES',
  LoadDataSourceTypes = 'LOAD_DATA_SOURCE_TYPES',
  LoadDataSource = 'LOAD_DATA_SOURCE',
  LoadDataSourceMeta = 'LOAD_DATA_SOURCE_META',
  LoadDataSourcePermissions = 'LOAD_DATA_SOURCE_PERMISSIONS',
  SetDataSourcesSearchQuery = 'SET_DATA_SOURCES_SEARCH_QUERY',
  SetDataSourcesLayoutMode = 'SET_DATA_SOURCES_LAYOUT_MODE',
  SetDataSourceTypeSearchQuery = 'SET_DATA_SOURCE_TYPE_SEARCH_QUERY',
}

export interface LoadDataSourcesAction {
  type: ActionTypes.LoadDataSources;
  payload: DataSource[];
}

export interface SetDataSourcesSearchQueryAction {
  type: ActionTypes.SetDataSourcesSearchQuery;
  payload: string;
}

export interface SetDataSourcesLayoutModeAction {
  type: ActionTypes.SetDataSourcesLayoutMode;
  payload: LayoutMode;
}

export interface LoadDataSourceTypesAction {
  type: ActionTypes.LoadDataSourceTypes;
  payload: Plugin[];
}

export interface SetDataSourceTypeSearchQueryAction {
  type: ActionTypes.SetDataSourceTypeSearchQuery;
  payload: string;
}

export interface LoadDataSourceAction {
  type: ActionTypes.LoadDataSource;
  payload: DataSource;
}

export interface LoadDataSourceMetaAction {
  type: ActionTypes.LoadDataSourceMeta;
  payload: Plugin;
}

export interface LoadDataSourcePermissionsAction {
  type: ActionTypes.LoadDataSourcePermissions;
  payload: DataSourcePermissionDTO;
}

const dataSourcesLoaded = (dataSources: DataSource[]): LoadDataSourcesAction => ({
  type: ActionTypes.LoadDataSources,
  payload: dataSources,
});

const dataSourceLoaded = (dataSource: DataSource): LoadDataSourceAction => ({
  type: ActionTypes.LoadDataSource,
  payload: dataSource,
});

const dataSourceMetaLoaded = (dataSourceMeta: Plugin): LoadDataSourceMetaAction => ({
  type: ActionTypes.LoadDataSourceMeta,
  payload: dataSourceMeta,
});

const dataSourceTypesLoaded = (dataSourceTypes: Plugin[]): LoadDataSourceTypesAction => ({
  type: ActionTypes.LoadDataSourceTypes,
  payload: dataSourceTypes,
});

const dataSourcePermissionsLoaded = (
  dataSourcePermission: DataSourcePermissionDTO
): LoadDataSourcePermissionsAction => ({
  type: ActionTypes.LoadDataSourcePermissions,
  payload: dataSourcePermission,
});

export const setDataSourcesSearchQuery = (searchQuery: string): SetDataSourcesSearchQueryAction => ({
  type: ActionTypes.SetDataSourcesSearchQuery,
  payload: searchQuery,
});

export const setDataSourcesLayoutMode = (layoutMode: LayoutMode): SetDataSourcesLayoutModeAction => ({
  type: ActionTypes.SetDataSourcesLayoutMode,
  payload: layoutMode,
});

export const setDataSourceTypeSearchQuery = (query: string): SetDataSourceTypeSearchQueryAction => ({
  type: ActionTypes.SetDataSourceTypeSearchQuery,
  payload: query,
});

export type Action =
  | LoadDataSourcesAction
  | SetDataSourcesSearchQueryAction
  | SetDataSourcesLayoutModeAction
  | UpdateLocationAction
  | LoadDataSourceTypesAction
  | SetDataSourceTypeSearchQueryAction
  | LoadDataSourceAction
  | UpdateNavIndexAction
  | LoadDataSourceMetaAction
  | LoadDataSourcePermissionsAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadDataSources(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/datasources');
    dispatch(dataSourcesLoaded(response));
  };
}

export function loadDataSource(id: number): ThunkResult<void> {
  return async dispatch => {
    const dataSource = await getBackendSrv().get(`/api/datasources/${id}`);
    const pluginInfo = await getBackendSrv().get(`/api/plugins/${dataSource.type}/settings`);
    dispatch(dataSourceLoaded(dataSource));
    dispatch(dataSourceMetaLoaded(pluginInfo));
    dispatch(updateNavIndex(buildNavModel(dataSource, pluginInfo)));
  };
}

export function addDataSource(plugin: Plugin): ThunkResult<void> {
  return async (dispatch, getStore) => {
    await dispatch(loadDataSources());

    const dataSources = getStore().dataSources.dataSources;

    const newInstance = {
      name: plugin.name,
      type: plugin.id,
      access: 'proxy',
      isDefault: dataSources.length === 0,
    };

    if (nameExits(dataSources, newInstance.name)) {
      newInstance.name = findNewName(dataSources, newInstance.name);
    }

    const result = await getBackendSrv().post('/api/datasources', newInstance);
    dispatch(updateLocation({ path: `/datasources/edit/${result.id}` }));
  };
}

export function loadDataSourceTypes(): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });
    dispatch(dataSourceTypesLoaded(result));
  };
}

export function loadDataSourcePermissions(id: number): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get(`/api/datasources/${id}/permissions`);
    dispatch(dataSourcePermissionsLoaded(response));
  };
}

export function enableDataSourcePermissions(id: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post(`/api/datasources/${id}/enable-permissions`, {});
    dispatch(loadDataSourcePermissions(id));
  };
}

export function disableDataSourcePermissions(id: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post(`/api/datasources/${id}/disable-permissions`, {});
    dispatch(loadDataSourcePermissions(id));
  };
}

export function addDataSourcePermission(id: number, data: object): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post(`/api/datasources/${id}/permissions`, data);

    dispatch(loadDataSourcePermissions(id));
  };
}

export function removeDataSourcePermission(id: number, permissionId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().delete(`/api/datasources/${id}/permissions/${permissionId}`);
    dispatch(loadDataSourcePermissions(id));
  };
}

export function nameExits(dataSources, name) {
  return (
    dataSources.filter(dataSource => {
      return dataSource.name === name;
    }).length > 0
  );
}

export function findNewName(dataSources, name) {
  // Need to loop through current data sources to make sure
  // the name doesn't exist
  while (nameExits(dataSources, name)) {
    // If there's a duplicate name that doesn't end with '-x'
    // we can add -1 to the name and be done.
    if (!nameHasSuffix(name)) {
      name = `${name}-1`;
    } else {
      // if there's a duplicate name that ends with '-x'
      // we can try to increment the last digit until the name is unique

      // remove the 'x' part and replace it with the new number
      name = `${getNewName(name)}${incrementLastDigit(getLastDigit(name))}`;
    }
  }

  return name;
}

function nameHasSuffix(name) {
  return name.endsWith('-', name.length - 1);
}

function getLastDigit(name) {
  return parseInt(name.slice(-1), 10);
}

function incrementLastDigit(digit) {
  return isNaN(digit) ? 1 : digit + 1;
}

function getNewName(name) {
  return name.slice(0, name.length - 1);
}
