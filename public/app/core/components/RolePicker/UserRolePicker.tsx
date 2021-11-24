import React, { FC } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Role, OrgRole } from 'app/types';
import { RolePicker } from './RolePicker';

export interface Props {
  builtInRole: OrgRole;
  userId: number;
  orgId?: number;
  onBuiltinRoleChange: (newRole: OrgRole) => void;
  getRoleOptions?: () => Promise<Role[]>;
  getBuiltinRoles?: () => Promise<{ [key: string]: Role[] }>;
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
}

export const UserRolePicker: FC<Props> = ({
  builtInRole,
  userId,
  orgId,
  onBuiltinRoleChange,
  getRoleOptions,
  getBuiltinRoles,
  disabled,
  builtinRolesDisabled,
}) => {
  return (
    <RolePicker
      builtInRole={builtInRole}
      onRolesChange={(roles) => updateUserRoles(roles, userId, orgId)}
      onBuiltinRoleChange={onBuiltinRoleChange}
      getRoleOptions={() => (getRoleOptions ? getRoleOptions() : fetchRoleOptions(orgId))}
      getRoles={() => fetchUserRoles(userId, orgId)}
      getBuiltinRoles={() => (getBuiltinRoles ? getBuiltinRoles() : fetchBuiltinRoles(orgId))}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
    />
  );
};

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
