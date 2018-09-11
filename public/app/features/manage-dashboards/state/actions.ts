import { DashboardListItem, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '../../../core/services/backend_srv';

export enum ActionTypes {
  SearchDashboards = 'SEARCH_DASHBOARDS',
}

export interface SearchDashboardsAction {
  type: ActionTypes.SearchDashboards;
  payload: DashboardListItem[];
}

export type Action = SearchDashboardsAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

const dashboardsLoaded = (listItems: DashboardListItem[]): SearchDashboardsAction => ({
  type: ActionTypes.SearchDashboards,
  payload: listItems,
});

export function searchDashboards(query: string): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv()
      .get('/api/search', query)
      .then(response => {
        dispatch(dashboardsLoaded(response));
      });
  };
}
