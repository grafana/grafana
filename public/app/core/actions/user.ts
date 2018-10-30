import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '../services/backend_srv';
import { DashboardAcl, DashboardSearchHit, StoreState } from '../../types';

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;

export type Action = LoadStarredDashboardsAction;

export enum ActionTypes {
  LoadStarredDashboards = 'LOAD_STARRED_DASHBOARDS',
}

interface LoadStarredDashboardsAction {
  type: ActionTypes.LoadStarredDashboards;
  payload: DashboardSearchHit[];
}

const starredDashboardsLoaded = (dashboards: DashboardAcl[]) => ({
  type: ActionTypes.LoadStarredDashboards,
  payload: dashboards,
});

export function loadStarredDashboards(): ThunkResult<void> {
  return async dispatch => {
    const starredDashboards = await getBackendSrv().search({ starred: true });
    dispatch(starredDashboardsLoaded(starredDashboards));
  };
}
