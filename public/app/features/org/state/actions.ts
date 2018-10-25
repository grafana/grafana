import { ThunkAction } from 'redux-thunk';
import { DashboardAcl, Organization, OrganisationPreferences, StoreState } from 'app/types';
import { getBackendSrv } from '../../../core/services/backend_srv';

export enum ActionTypes {
  LoadOrganisation = 'LOAD_ORGANISATION',
  LoadPreferences = 'LOAD_PREFERENCES',
  LoadStarredDashboards = 'LOAD_STARRED_DASHBOARDS',
}

interface LoadOrganizationAction {
  type: ActionTypes.LoadOrganisation;
  payload: Organization;
}

interface LoadPreferencesAction {
  type: ActionTypes.LoadPreferences;
  payload: OrganisationPreferences;
}

interface LoadStarredDashboardsAction {
  type: ActionTypes.LoadStarredDashboards;
  payload: DashboardAcl[];
}

const organisationLoaded = (organisation: Organization) => ({
  type: ActionTypes.LoadOrganisation,
  payload: organisation,
});

const preferencesLoaded = (preferences: OrganisationPreferences) => ({
  type: ActionTypes.LoadPreferences,
  payload: preferences,
});

const starredDashboardsLoaded = (dashboards: DashboardAcl[]) => ({
  type: ActionTypes.LoadStarredDashboards,
  payload: dashboards,
});

export type Action = LoadOrganizationAction | LoadPreferencesAction | LoadStarredDashboardsAction;
type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;

export function loadOrganization(): ThunkResult<void> {
  return async dispatch => {
    const organisationResponse = await getBackendSrv().get('/api/org');
    dispatch(organisationLoaded(organisationResponse));

    return organisationResponse;
  };
}

export function loadOrganizationPreferences(): ThunkResult<void> {
  return async dispatch => {
    const preferencesResponse = await getBackendSrv().get('/api/org/preferences');
    dispatch(preferencesLoaded(preferencesResponse));

    const starredDashboards = await getBackendSrv().search({ starred: true });
    dispatch(starredDashboardsLoaded(starredDashboards));

    return preferencesResponse;
  };
}
