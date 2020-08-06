import { ThunkResult } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { organizationLoaded } from './reducers';
import { updateConfigurationSubtitle } from 'app/core/actions';

type LoadOrganizationDependencies = { getBackendSrv: typeof getBackendSrv };
export function loadOrganization(
  dependencies: LoadOrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<any> {
  return async dispatch => {
    const organizationResponse = await dependencies.getBackendSrv().get('/api/org');
    dispatch(organizationLoaded(organizationResponse));

    return organizationResponse;
  };
}

type UpdateOrganizationDependencies = { getBackendSrv: typeof getBackendSrv };
export function updateOrganization(
  dependencies: UpdateOrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<any> {
  return async (dispatch, getStore) => {
    const organization = getStore().organization.organization;

    await dependencies.getBackendSrv().put('/api/org', { name: organization.name });

    dispatch(updateConfigurationSubtitle(organization.name));
    dispatch(loadOrganization(dependencies));
  };
}
