import { ThunkAction } from 'redux-thunk';
import { DataSource, DataSourceType, StoreState } from 'app/types';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { LayoutMode } from '../../../core/components/LayoutSelector/LayoutSelector';
import { updateLocation } from '../../../core/actions';
import { UpdateLocationAction } from '../../../core/actions/location';

export enum ActionTypes {
  LoadDataSources = 'LOAD_DATA_SOURCES',
  LoadDataSourceTypes = 'LOAD_DATA_SOURCE_TYPES',
  SetDataSourcesSearchQuery = 'SET_DATA_SOURCES_SEARCH_QUERY',
  SetDataSourcesLayoutMode = 'SET_DATA_SOURCES_LAYOUT_MODE',
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
  payload: DataSourceType[];
}

const dataSourcesLoaded = (dataSources: DataSource[]): LoadDataSourcesAction => ({
  type: ActionTypes.LoadDataSources,
  payload: dataSources,
});

const dataSourceTypesLoaded = (dataSourceTypes: DataSourceType[]): LoadDataSourceTypesAction => ({
  type: ActionTypes.LoadDataSourceTypes,
  payload: dataSourceTypes,
});

export const setDataSourcesSearchQuery = (searchQuery: string): SetDataSourcesSearchQueryAction => ({
  type: ActionTypes.SetDataSourcesSearchQuery,
  payload: searchQuery,
});

export const setDataSourcesLayoutMode = (layoutMode: LayoutMode): SetDataSourcesLayoutModeAction => ({
  type: ActionTypes.SetDataSourcesLayoutMode,
  payload: layoutMode,
});

export type Action =
  | LoadDataSourcesAction
  | SetDataSourcesSearchQueryAction
  | SetDataSourcesLayoutModeAction
  | UpdateLocationAction
  | LoadDataSourceTypesAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadDataSources(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/datasources');
    dispatch(dataSourcesLoaded(response));
  };
}

export function addDataSource(name: string, type: string): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().post('/api/datasources', { name: name, type: type, access: 'proxy' });
    dispatch(updateLocation({ path: `/datasources/edit/${result.id}` }));
  };
}

export function loadDataSourceTypes(): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });
    dispatch(dataSourceTypesLoaded(result));
  };
}
