import { ThunkResult } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { organizationLoaded } from './reducers';
import { updateConfigurationSubtitle } from 'app/core/actions';

type OrganizationDependencies = { getBackendSrv: typeof getBackendSrv };

export function loadOrganization(
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<any> {
  return async dispatch => {
    const organizationResponse = await dependencies.getBackendSrv().get('/api/org');
    dispatch(organizationLoaded(organizationResponse));

    return organizationResponse;
  };
}

export function updateOrganization(
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<any> {
  return async (dispatch, getStore) => {
    const organization = getStore().organization.organization;

    await dependencies.getBackendSrv().put('/api/org', { name: organization.name });

    dispatch(updateConfigurationSubtitle(organization.name));
    dispatch(loadOrganization(dependencies));
  };
}
