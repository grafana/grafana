import React, { FC } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Role, OrgRole } from 'app/types';
import { RolePicker } from './RolePicker';

export interface Props {
  builtInRole: OrgRole;
  userId: number;
  orgId?: number;
  onBuiltinRoleChange: (newRole: OrgRole) => void;
  disabled?: boolean;
}

export const UserRolePicker: FC<Props> = ({ builtInRole, userId, orgId, onBuiltinRoleChange, disabled }) => {
  return (
    <RolePicker
      builtInRole={builtInRole}
      onRolesChange={(roles) => updateUserRoles(roles, userId, orgId)}
      onBuiltinRoleChange={onBuiltinRoleChange}
      getRoleOptions={async () => getRolesOptions(orgId)}
      getRoles={async () => getUserRoles(userId, orgId)}
      getBuiltinRoles={async () => getBuiltinRoles(orgId)}
      disabled={disabled}
    />
  );
};

export const getRolesOptions = async (orgId?: number, query?: string): Promise<Role[]> => {
  let rolesUrl = '/api/access-control/roles';
  if (orgId) {
    rolesUrl += `?targetOrgId=${orgId}`;
  }
  const roles = await getBackendSrv().get(rolesUrl);
  if (!roles || !roles.length) {
    return [];
  }
  return roles;
};

export const getBuiltinRoles = (orgId?: number): Promise<{ [key: string]: Role[] }> => {
  let builtinRolesUrl = '/api/access-control/builtin-roles';
  if (orgId) {
    builtinRolesUrl += `?targetOrgId=${orgId}`;
  }
  return getBackendSrv().get(builtinRolesUrl);
};

export const getUserRoles = async (userId: number, orgId?: number): Promise<Role[]> => {
  let userRolesUrl = `/api/access-control/users/${userId}/roles`;
  if (orgId) {
    userRolesUrl += `?targetOrgId=${orgId}`;
  }
  const roles = await getBackendSrv().get(userRolesUrl);
  if (!roles || !roles.length) {
    return [];
  }
  return roles;
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
