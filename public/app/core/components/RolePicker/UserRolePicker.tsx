import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import { contextSrv } from 'app/core/core';
import { Role, OrgRole, AccessControlAction } from 'app/types';
import { RolePicker } from './RolePicker';
import { fetchUserRoles, updateUserRoles } from './api';

export interface Props {
  builtInRole: OrgRole;
  userId: number;
  orgId?: number;
  onBuiltinRoleChange: (newRole: OrgRole) => void;
  roleOptions: Role[];
  builtInRoles?: { [key: string]: Role[] };
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
}

export const UserRolePicker: FC<Props> = ({
  builtInRole,
  userId,
  orgId,
  onBuiltinRoleChange,
  roleOptions,
  builtInRoles,
  disabled,
  builtinRolesDisabled,
}) => {
  const [appliedRoles, setAppliedRoles] = useState<Role[]>([]);

  const { loading } = useAsync(async () => {
    try {
      if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesList)) {
        const userRoles = await fetchUserRoles(userId, orgId);
        setAppliedRoles(userRoles);
      } else {
        setAppliedRoles([]);
      }
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
  }, [orgId, userId]);

  return (
    <RolePicker
      builtInRole={builtInRole}
      onRolesChange={(roles) => updateUserRoles(roles, userId, orgId)}
      onBuiltinRoleChange={onBuiltinRoleChange}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      builtInRoles={builtInRoles}
      isLoading={loading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
      showBuiltInRole
    />
  );
};
