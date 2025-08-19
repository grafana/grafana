import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { Role } from 'app/types/accessControl';

import { addDisplayNameForFixedRole, addFilteredDisplayName } from './utils';

export const fetchRoleOptions = async (orgId?: number): Promise<Role[]> => {
  let rolesUrl = '/api/access-control/roles?delegatable=true';
  if (orgId) {
    rolesUrl += `&targetOrgId=${orgId}`;
  }
  const roles = await getBackendSrv().get(rolesUrl);
  if (!roles || !roles.length) {
    return [];
  }
  return roles.map(addDisplayNameForFixedRole).map(addFilteredDisplayName);
};

export const fetchUserRoles = async (userId: number, orgId?: number): Promise<Role[]> => {
  let userRolesUrl = `/api/access-control/users/${userId}/roles?includeMapped=true`;
  if (orgId) {
    userRolesUrl += `&targetOrgId=${orgId}`;
  }
  try {
    const roles = await getBackendSrv().get(userRolesUrl);
    if (!roles || !roles.length) {
      return [];
    }
    return roles.map(addDisplayNameForFixedRole).map(addFilteredDisplayName);
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return [];
  }
};

export const updateUserRoles = (roles: Role[], userId: number, orgId?: number) => {
  let userRolesUrl = `/api/access-control/users/${userId}/roles`;
  if (orgId) {
    userRolesUrl += `?targetOrgId=${orgId}`;
  }
  const filteredRoles = roles.filter((role) => !role.mapped);
  const roleUids = filteredRoles.flatMap((x) => x.uid);
  return getBackendSrv().put(userRolesUrl, {
    orgId,
    roleUids,
  });
};

export const fetchTeamRoles = async (teamId: number, orgId?: number): Promise<Role[]> => {
  let teamRolesUrl = `/api/access-control/teams/${teamId}/roles`;
  if (orgId) {
    teamRolesUrl += `?targetOrgId=${orgId}`;
  }
  try {
    const roles = await getBackendSrv().get(teamRolesUrl);
    if (!roles || !roles.length) {
      return [];
    }
    return roles.map(addDisplayNameForFixedRole).map(addFilteredDisplayName);
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return [];
  }
};

export const updateTeamRoles = (roles: Role[], teamId: number, orgId?: number) => {
  let teamRolesUrl = `/api/access-control/teams/${teamId}/roles`;
  if (orgId) {
    teamRolesUrl += `?targetOrgId=${orgId}`;
  }
  const roleUids = roles.flatMap((x) => x.uid);

  return getBackendSrv().put(teamRolesUrl, {
    orgId,
    roleUids,
  });
};
