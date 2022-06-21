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
  onApplyRoles?: (newRoles: Role[], userId: number, orgId: number | undefined) => void;
  pendingRoles?: Role[];
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
  pendingRoles,
}) => {
  const [{ loading, value: appliedRoles = [] }, getUserRoles] = useAsyncFn(async () => {
    try {
      if (updateDisabled) {
        if (pendingRoles?.length! > 0) {
          return pendingRoles;
        }
      }
      if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesList)) {
        return await fetchUserRoles(userId, orgId);
      }
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
    return [];
  }, [orgId, userId, pendingRoles]);

  useEffect(() => {
    // only load roles when there is an Org selected
    if (orgId) {
      getUserRoles();
    }
  }, [orgId, getUserRoles, pendingRoles]);

  const onRolesChange = async (roles: Role[]) => {
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
      appliedRoles={appliedRoles}
      builtInRole={builtInRole}
      onRolesChange={onRolesChange}
      onBuiltinRoleChange={onBuiltinRoleChange}
      roleOptions={roleOptions}
      builtInRoles={builtInRoles}
      isLoading={loading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
      showBuiltInRole
      updateDisabled={updateDisabled || false}
    />
  );
};
