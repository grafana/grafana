import { getBackendSrv } from '@grafana/runtime';
import { updateConfigurationSubtitle } from 'app/core/actions';
import { ThunkResult, UserOrg } from 'app/types';

import { organizationLoaded, userOrganizationsLoaded } from './reducers';

type OrganizationDependencies = { getBackendSrv: typeof getBackendSrv };

export function loadOrganization(
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<void> {
  return async (dispatch) => {
    const organizationResponse = await dependencies.getBackendSrv().get('/api/org');
    dispatch(organizationLoaded(organizationResponse));

    return organizationResponse;
  };
}

export function updateOrganization(
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const organization = getStore().organization.organization;

    await dependencies.getBackendSrv().put('/api/org', { name: organization.name });

    dispatch(updateConfigurationSubtitle(organization.name));
    dispatch(loadOrganization(dependencies));
  };
}

export function setUserOrganization(
  orgId: number,
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<void> {
  return async (dispatch) => {
    const organizationResponse = await dependencies.getBackendSrv().post('/api/user/using/' + orgId);

    dispatch(updateConfigurationSubtitle(organizationResponse.name));
  };
}

export function createOrganization(
  newOrg: { name: string },
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<void> {
  return async (dispatch) => {
    const result = await dependencies.getBackendSrv().post('/api/orgs/', newOrg);

    dispatch(setUserOrganization(result.orgId));
  };
}

export function getUserOrganizations(
  dependencies: OrganizationDependencies = { getBackendSrv: getBackendSrv }
): ThunkResult<Promise<UserOrg[]>> {
  return async (dispatch) => {
    const result = await dependencies.getBackendSrv().get<UserOrg[]>('/api/user/orgs');
    dispatch(userOrganizationsLoaded(result));

    return result;
  };
}
