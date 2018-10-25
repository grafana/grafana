import { ThunkAction } from 'redux-thunk';
import { Organisation, OrganisationPreferences, StoreState } from 'app/types';
import { getBackendSrv } from '../../../core/services/backend_srv';

export enum ActionTypes {
  LoadOrganisation = 'LOAD_ORGANISATION',
  LoadPreferences = 'LOAD_PREFERENCES',
}

interface LoadOrganisationAction {
  type: ActionTypes.LoadOrganisation;
  payload: Organisation;
}

interface LoadPreferencesAction {
  type: ActionTypes.LoadPreferences;
  payload: OrganisationPreferences;
}

const organisationLoaded = (organisation: Organisation) => ({
  type: ActionTypes.LoadOrganisation,
  payload: organisation,
});

const preferencesLoaded = (preferences: OrganisationPreferences) => ({
  type: ActionTypes.LoadPreferences,
  payload: preferences,
});

export type Action = LoadOrganisationAction | LoadPreferencesAction;
type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;

export function loadOrganisation(): ThunkResult<void> {
  return async dispatch => {
    const organisationResponse = await getBackendSrv().get('/api/org');
    const preferencesResponse = await getBackendSrv().get('/api/org/preferences');
    dispatch(organisationLoaded(organisationResponse));
    dispatch(preferencesLoaded(preferencesResponse));
  };
}
