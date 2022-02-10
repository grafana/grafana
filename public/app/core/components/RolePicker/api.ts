import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';

export const fetchRoleOptions = async (orgId?: number, query?: string): Promise<Role[]> => {
  let rolesUrl = '/api/access-control/roles?delegatable=true';
  if (orgId) {
    rolesUrl += `&targetOrgId=${orgId}`;
  }
  const roles = await getBackendSrv().get(rolesUrl);
  if (!roles || !roles.length) {
    return [];
  }
  return roles;
};

export const fetchBuiltinRoles = (orgId?: number): Promise<{ [key: string]: Role[] }> => {
  let builtinRolesUrl = '/api/access-control/builtin-roles';
  if (orgId) {
    builtinRolesUrl += `?targetOrgId=${orgId}`;
  }
  return getBackendSrv().get(builtinRolesUrl);
};

export const fetchUserRoles = async (userId: number, orgId?: number): Promise<Role[]> => {
  let userRolesUrl = `/api/access-control/users/${userId}/roles`;
  if (orgId) {
    userRolesUrl += `?targetOrgId=${orgId}`;
  }
  try {
    const roles = await getBackendSrv().get(userRolesUrl);
    if (!roles || !roles.length) {
      return [];
    }
    return roles;
  } catch (error) {
    error.isHandled = true;
    return [];
  }
};

export const updateUserRoles = (roleUids: string[], userId: number, orgId?: number) => {
  let userRolesUrl = `/api/access-control/users/${userId}/roles`;
  if (orgId) {
    userRolesUrl += `?targetOrgId=${orgId}`;
  }
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
    return roles;
  } catch (error) {
    error.isHandled = true;
    return [];
  }
};

export const updateTeamRoles = (roleUids: string[], teamId: number, orgId?: number) => {
  let teamRolesUrl = `/api/access-control/teams/${teamId}/roles`;
  if (orgId) {
    teamRolesUrl += `?targetOrgId=${orgId}`;
  }
  return getBackendSrv().put(teamRolesUrl, {
    orgId,
    roleUids,
  });
};
