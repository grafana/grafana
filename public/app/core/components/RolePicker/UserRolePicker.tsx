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
      getRoleOptions={getRolesOptions}
      getRoles={async () => getUserRoles(userId, orgId)}
      getBuiltinRoles={getBuiltinRoles}
      disabled={disabled}
    />
  );
};

export const getRolesOptions = async (query?: string): Promise<Role[]> => {
  const roles = await getBackendSrv().get('/api/access-control/roles');
  if (!roles || !roles.length) {
    return [];
  }
  return roles;
};

export const getBuiltinRoles = (): Promise<{ [key: string]: Role[] }> => {
  return getBackendSrv().get('/api/access-control/builtin-roles');
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
