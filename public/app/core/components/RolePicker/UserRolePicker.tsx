import React, { FC, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { contextSrv } from 'app/core/core';
import { Role, OrgRole, AccessControlAction } from 'app/types';

import { RolePicker } from './RolePicker';
import { fetchUserRoles, updateUserRoles } from './api';

export interface Props {
  basicRole: OrgRole;
  userId: number;
  orgId?: number;
  onBasicRoleChange: (newRole: OrgRole) => void;
  roleOptions: Role[];
  disabled?: boolean;
  basicRoleDisabled?: boolean;
  /**
   * Set whether the component should send a request with the new roles to the
   * backend in UserRolePicker.onRolesChange (apply=false), or call {@link onApplyRoles}
   * with the updated list of roles (apply=true).
   *
   * Besides it sets the RolePickerMenu's Button title to
   *   * `Update` in case apply equals false
   *   * `Apply` in case apply equals true
   *
   * @default false
   */
  apply?: boolean;
  onApplyRoles?: (newRoles: Role[], userId: number, orgId: number | undefined) => void;
  pendingRoles?: Role[];
  maxWidth?: string | number;
}

export const UserRolePicker: FC<Props> = ({
  basicRole,
  userId,
  orgId,
  onBasicRoleChange,
  roleOptions,
  disabled,
  basicRoleDisabled,
  apply = false,
  onApplyRoles,
  pendingRoles,
  maxWidth,
}) => {
  const [{ loading, value: appliedRoles = [] }, getUserRoles] = useAsyncFn(async () => {
    try {
      if (apply && Boolean(pendingRoles?.length)) {
        return pendingRoles;
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
    if (!apply) {
      await updateUserRoles(roles, userId, orgId);
      await getUserRoles();
    } else if (onApplyRoles) {
      onApplyRoles(roles, userId, orgId);
    }
  };

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  return (
    <RolePicker
      appliedRoles={appliedRoles}
      basicRole={basicRole}
      onRolesChange={onRolesChange}
      onBasicRoleChange={onBasicRoleChange}
      roleOptions={roleOptions}
      isLoading={loading}
      disabled={disabled}
      basicRoleDisabled={basicRoleDisabled}
      showBasicRole
      apply={apply}
      canUpdateRoles={canUpdateRoles}
      maxWidth={maxWidth}
    />
  );
};
