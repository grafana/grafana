import { ThunkResult } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { organizationLoaded } from './reducers';

export function loadOrganization(): ThunkResult<any> {
  return async dispatch => {
    const organizationResponse = await getBackendSrv().get('/api/org');
    dispatch(organizationLoaded(organizationResponse));

    return organizationResponse;
  };
}

export function updateOrganization(): ThunkResult<any> {
  return async (dispatch, getStore) => {
    const organization = getStore().organization.organization;

    await getBackendSrv().put('/api/org', { name: organization.name });

    dispatch(loadOrganization());
  };
}
