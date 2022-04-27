import React, { FC, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

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
  updateDisabled?: boolean;
  onApplyRoles?: (newRoles: string[], userId: number, orgId: number | undefined) => void;
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
  updateDisabled,
  onApplyRoles,
}) => {
  const [{ loading, value: appliedRoles = [] }, getUserRoles] = useAsyncFn(async () => {
    try {
      if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesList)) {
        return await fetchUserRoles(userId, orgId);
      }
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
    return [];
  }, [orgId, userId]);

  useEffect(() => {
    // only load roles when there is an Org selected
    if (orgId) {
      getUserRoles();
    }
  }, [orgId, userId, getUserRoles]);

  const onRolesChange = async (roles: string[]) => {
    if (!updateDisabled) {
      await updateUserRoles(roles, userId, orgId);
      await getUserRoles();
    } else {
      if (onApplyRoles) {
        onApplyRoles(roles, userId, orgId);
      }
    }
  };

  return (
    <RolePicker
      builtInRole={builtInRole}
      onRolesChange={onRolesChange}
      onBuiltinRoleChange={onBuiltinRoleChange}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      builtInRoles={builtInRoles}
      isLoading={loading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
      showBuiltInRole
      updateDisabled={updateDisabled || false}
    />
  );
};
