/**
 * @deprecated These functions are legacy API calls. For new code, use the RTK Query API from:
 * `app/api/clients/roles` which provides:
 * - useListTeamRolesQuery
 * - useSetTeamRolesMutation
 * - useListUserRolesQuery
 * - useSetUserRolesMutation
 * - useListRolesQuery
 */

import { getBackendSrv } from '@grafana/runtime';
import { addDisplayNameForFixedRole, addFilteredDisplayName } from 'app/core/utils/roles';
import { Role } from 'app/types/accessControl';

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
