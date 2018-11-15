import { ThunkAction } from 'redux-thunk';
import { Organization, StoreState } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;

export enum ActionTypes {
  LoadOrganization = 'LOAD_ORGANISATION',
  SetOrganizationName = 'SET_ORGANIZATION_NAME',
}

interface LoadOrganizationAction {
  type: ActionTypes.LoadOrganization;
  payload: Organization;
}

interface SetOrganizationNameAction {
  type: ActionTypes.SetOrganizationName;
  payload: string;
}

const organisationLoaded = (organisation: Organization) => ({
  type: ActionTypes.LoadOrganization,
  payload: organisation,
});

export const setOrganizationName = (orgName: string) => ({
  type: ActionTypes.SetOrganizationName,
  payload: orgName,
});

export type Action = LoadOrganizationAction | SetOrganizationNameAction;

export function loadOrganization(): ThunkResult<void> {
  return async dispatch => {
    const organisationResponse = await getBackendSrv().get('/api/org');
    dispatch(organisationLoaded(organisationResponse));

    return organisationResponse;
  };
}

export function updateOrganization() {
  return async (dispatch, getStore) => {
    const organization = getStore().organization.organization;

    await getBackendSrv().put('/api/org', { name: organization.name });

    dispatch(loadOrganization());
  };
}
