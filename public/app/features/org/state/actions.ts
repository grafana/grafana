import { ThunkResult } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { userOrganizationsLoaded } from './reducers';
import { updateConfigurationSubtitle } from 'app/core/actions';

type OrganizationDependencies = { getBackendSrv: typeof getBackendSrv };

export function setUserOrganization(
  orgId: number,
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<any> {
  return async (dispatch) => {
    const organizationResponse = await dependencies.getBackendSrv().post('/api/user/using/' + orgId);

    dispatch(updateConfigurationSubtitle(organizationResponse.name));
  };
}

export function createOrganization(
  newOrg: { name: string },
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<any> {
  return async (dispatch) => {
    const result = await dependencies.getBackendSrv().post('/api/orgs/', newOrg);

    dispatch(setUserOrganization(result.orgId));
  };
}

export function getUserOrganizations(
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<any> {
  return async (dispatch) => {
    const result = await dependencies.getBackendSrv().get('/api/user/orgs');
    dispatch(userOrganizationsLoaded(result));

    return result;
  };
}
