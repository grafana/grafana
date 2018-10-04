import { ThunkAction } from 'redux-thunk';
import { DataSource, StoreState } from 'app/types';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { LayoutMode } from '../../../core/components/LayoutSelector/LayoutSelector';

export enum ActionTypes {
  LoadDataSources = 'LOAD_DATA_SOURCES',
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

const dataSourcesLoaded = (dataSources: DataSource[]): LoadDataSourcesAction => ({
  type: ActionTypes.LoadDataSources,
  payload: dataSources,
});

export const setDataSourcesSearchQuery = (searchQuery: string): SetDataSourcesSearchQueryAction => ({
  type: ActionTypes.SetDataSourcesSearchQuery,
  payload: searchQuery,
});

export const setDataSourcesLayoutMode = (layoutMode: LayoutMode): SetDataSourcesLayoutModeAction => ({
  type: ActionTypes.SetDataSourcesLayoutMode,
  payload: layoutMode,
});

export type Action = LoadDataSourcesAction | SetDataSourcesSearchQueryAction | SetDataSourcesLayoutModeAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadDataSources(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/datasources');
    dispatch(dataSourcesLoaded(response));
  };
}
