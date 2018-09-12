import _ from 'lodash';
import { DashboardListItem, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '../../../core/services/backend_srv';

export enum ActionTypes {
  SearchDashboards = 'SEARCH_DASHBOARDS',
  SetDashboardSearchQuery = 'SET_DASHBOARD_SEARCH_QUERY',
  RemoveStarredFilter = 'REMOVE_STARRED_FILTER',
  RemoveTag = 'REMOVE_TAG',
  ClearFilters = 'CLEAR_FILTERS',
}

export interface SearchDashboardsAction {
  type: ActionTypes.SearchDashboards;
  payload: DashboardListItem[];
}

export interface SetSearchDashboardSearchQueryAction {
  type: ActionTypes.SetDashboardSearchQuery;
  payload: string;
}

export interface RemoveStarredFilterAction {
  type: ActionTypes.RemoveStarredFilter;
}

export interface RemoveTagAction {
  type: ActionTypes.RemoveTag;
  payload: string;
}

interface ClearFiltersAction {
  type: ActionTypes.ClearFilters;
}

export type Action =
  | SearchDashboardsAction
  | SetSearchDashboardSearchQueryAction
  | RemoveStarredFilterAction
  | RemoveTagAction
  | ClearFiltersAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

const dashboardsLoaded = (listItems: DashboardListItem[]): SearchDashboardsAction => ({
  type: ActionTypes.SearchDashboards,
  payload: listItems,
});

const setDashboardSearchQuery = (searchQuery: string): SetSearchDashboardSearchQueryAction => ({
  type: ActionTypes.SetDashboardSearchQuery,
  payload: searchQuery,
});

export const removeStarredFilter = (): RemoveStarredFilterAction => ({
  type: ActionTypes.RemoveStarredFilter,
});

export const removeTag = (tag: string): RemoveTagAction => ({
  type: ActionTypes.RemoveTag,
  payload: tag,
});

export const clearFilters = (): ClearFiltersAction => ({
  type: ActionTypes.ClearFilters,
});

async function refreshDashboardItemList(query) {
  return await getBackendSrv().get('/api/search', query);
}

export function updateSearchQuery(query: string): ThunkResult<void> {
  //const searchDashboardsDebounced = _.debounce(refreshDashboardItemList, 500, { trailing: true });

  return async (dispatch, getStore) => {
    dispatch(setDashboardSearchQuery(query));

    const dashboardQuery = getStore().manageDashboards.dashboardQuery;
    const response = await refreshDashboardItemList(dashboardQuery);
    dispatch(dashboardsLoaded(response));
  };
}
