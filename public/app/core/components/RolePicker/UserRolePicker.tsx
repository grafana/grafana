import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';
import { RolePicker } from './RolePicker';

// const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export interface Props {
  builtinRole: string;
  userId: number;
  orgId?: number;
  onBuiltinRoleChange: (newRole: string) => void;
}

export const UserRolePicker: FC<Props> = ({ builtinRole, userId, orgId, onBuiltinRoleChange }) => {
  const getRoles = async () => {
    const roles = await getUserRoles(userId, orgId);
    return roles.map((role) => role.uid);
  };

  return (
    <RolePicker
      // roles={userRoles}
      builtinRole={builtinRole}
      onChange={() => {}}
      onBuiltinRoleChange={onBuiltinRoleChange}
      getRoleOptions={getRolesOptions}
      getRoles={getRoles}
    />
  );
};

export const getRolesOptions = async (query?: string): Promise<Array<SelectableValue<string>>> => {
  const roles = await getBackendSrv().get('/api/access-control/roles');
  if (!roles || !roles.length) {
    return [];
  }
  return roles.map(
    (role: Role): SelectableValue => ({
      value: role.uid,
      label: role.name,
      description: role.description,
    })
  );
};

export const getUserRoles = async (userId: number, orgId?: number): Promise<Role[]> => {
  const roles = await getBackendSrv().get(`/api/access-control/users/${userId}/roles`);
  if (!roles || !roles.length) {
    return [];
  }
  return roles;
};
