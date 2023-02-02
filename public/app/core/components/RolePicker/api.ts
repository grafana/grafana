import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { Role } from 'app/types';

export const fetchRoleOptions = async (orgId?: number, query?: string): Promise<Role[]> => {
  let rolesUrl = '/api/access-control/roles?delegatable=true';
  if (orgId) {
    rolesUrl += `&targetOrgId=${orgId}`;
  }
  let roles = await getBackendSrv().get(rolesUrl);
  if (!roles || !roles.length) {
    return [];
  }
  roles = populateRoleDisplayNames(roles);
  return roles;
};

export const fetchUserRoles = async (userId: number, orgId?: number): Promise<Role[]> => {
  console.log(`fetchUserRoles: userId: ${userId}, orgId: ${orgId}`);
  let userRolesUrl = `/api/access-control/users/${userId}/roles`;
  if (orgId) {
    userRolesUrl += `?targetOrgId=${orgId}`;
  }
  try {
    let roles = await getBackendSrv().get(userRolesUrl);
    if (!roles || !roles.length) {
      return [];
    }
    roles = populateRoleDisplayNames(roles);
    return roles;
  } catch (error) {
    if (isFetchError(error)) {
      error.isHandled = true;
    }
    return [];
  }
};

const fixedRolePrefix = 'fixed:';
// fallbackDisplayName provides a fallback name for role
// that can be displayed in the ui for better readability
// example: currently this would give:
// fixed:datasources:name -> datasources name
// datasources:admin      -> datasources admin
const fallbackDisplayName = (rName: string) => {
  console.log(`fallbackDisplayName: rName: ${rName}`);
  let newRoleName = '';
  if (rName.startsWith(fixedRolePrefix)) {
    let rNameWithoutFixedPrefix = rName.replace(fixedRolePrefix, '');
    newRoleName = rNameWithoutFixedPrefix.replace(/:/g, ' ');
  } else {
    newRoleName = rName.replace(/:/g, ' ');
  }
  return newRoleName;
};

const populateRoleDisplayNames = (roles: Role[]) => {
  console.log(`populateRoleDisplayNames: roles: ${JSON.stringify(roles)}`);
  // filter role ids without a display name
  let rolesWithDisplayNames = roles.map((role) => {
    if (!role.displayName || role.displayName === '') {
      role.displayName = fallbackDisplayName(role.name);
      return role;
    } else if (role.displayName && role.displayName !== '') {
      return role;
    }
  });
  return rolesWithDisplayNames;
};

export const updateUserRoles = (roles: Role[], userId: number, orgId?: number) => {
  let userRolesUrl = `/api/access-control/users/${userId}/roles`;
  if (orgId) {
    userRolesUrl += `?targetOrgId=${orgId}`;
  }
  const roleUids = roles.flatMap((x) => x.uid);
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
