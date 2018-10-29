import { ThunkAction } from 'redux-thunk';
import { DashboardSearchHit, Organization, OrganizationPreferences, StoreState } from 'app/types';
import { getBackendSrv } from '../../../core/services/backend_srv';

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;

export enum ActionTypes {
  LoadOrganization = 'LOAD_ORGANISATION',
  LoadPreferences = 'LOAD_PREFERENCES',
  LoadStarredDashboards = 'LOAD_STARRED_DASHBOARDS',
  SetOrganizationName = 'SET_ORGANIZATION_NAME',
  SetOrganizationTheme = 'SET_ORGANIZATION_THEME',
  SetOrganizationHomeDashboard = 'SET_ORGANIZATION_HOME_DASHBOARD',
  SetOrganizationTimezone = 'SET_ORGANIZATION_TIMEZONE',
}

interface LoadOrganizationAction {
  type: ActionTypes.LoadOrganization;
  payload: Organization;
}

interface LoadPreferencesAction {
  type: ActionTypes.LoadPreferences;
  payload: OrganizationPreferences;
}

interface LoadStarredDashboardsAction {
  type: ActionTypes.LoadStarredDashboards;
  payload: DashboardSearchHit[];
}

interface SetOrganizationNameAction {
  type: ActionTypes.SetOrganizationName;
  payload: string;
}

interface SetOrganizationThemeAction {
  type: ActionTypes.SetOrganizationTheme;
  payload: string;
}

interface SetOrganizationHomeDashboardAction {
  type: ActionTypes.SetOrganizationHomeDashboard;
  payload: number;
}

interface SetOrganizationTimezoneAction {
  type: ActionTypes.SetOrganizationTimezone;
  payload: string;
}

const organisationLoaded = (organisation: Organization) => ({
  type: ActionTypes.LoadOrganization,
  payload: organisation,
});

const preferencesLoaded = (preferences: OrganizationPreferences) => ({
  type: ActionTypes.LoadPreferences,
  payload: preferences,
});

export const setOrganizationName = (orgName: string) => ({
  type: ActionTypes.SetOrganizationName,
  payload: orgName,
});

export const setOrganizationTheme = (theme: string) => ({
  type: ActionTypes.SetOrganizationTheme,
  payload: theme,
});

export const setOrganizationHomeDashboard = (id: number) => ({
  type: ActionTypes.SetOrganizationHomeDashboard,
  payload: id,
});

export const setOrganizationTimezone = (timezone: string) => ({
  type: ActionTypes.SetOrganizationTimezone,
  payload: timezone,
});

export type Action =
  | LoadOrganizationAction
  | LoadPreferencesAction
  | LoadStarredDashboardsAction
  | SetOrganizationNameAction
  | SetOrganizationThemeAction
  | SetOrganizationHomeDashboardAction
  | SetOrganizationTimezoneAction;

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
  };
}

export function updateOrganization() {
  return async (dispatch, getStore) => {
    const organization = getStore().organization.organization;

    await getBackendSrv().put('/api/org', { name: organization.name });

    dispatch(loadOrganization());
  };
}

export function updateOrganizationPreferences() {
  return async (dispatch, getStore) => {
    const preferences = getStore().organization.preferences;

    await getBackendSrv().put('/api/org/preferences', preferences);

    dispatch(loadOrganizationPreferences());
  };
}
