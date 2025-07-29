import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { OrgRole } from '@grafana/data';
import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types/accessControl';

import { RolePicker } from './RolePicker';
import { fetchUserRoles, updateUserRoles } from './api';

export interface Props {
  basicRole: OrgRole;
  roles?: Role[];
  userId: number;
  orgId?: number;
  onBasicRoleChange: (newRole: OrgRole) => void;
  roleOptions: Role[];
  disabled?: boolean;
  basicRoleDisabled?: boolean;
  basicRoleDisabledMessage?: string;
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
  width?: string | number;
  isLoading?: boolean;
}

export const UserRolePicker = ({
  basicRole,
  roles,
  userId,
  orgId,
  onBasicRoleChange,
  roleOptions,
  disabled,
  basicRoleDisabled,
  basicRoleDisabledMessage,
  apply = false,
  onApplyRoles,
  pendingRoles,
  maxWidth,
  width,
  isLoading,
}: Props) => {
  const [{ loading, value: appliedRoles = roles || [] }, getUserRoles] = useAsyncFn(async () => {
    try {
      if (roles) {
        return roles;
      }
      if (apply && Boolean(pendingRoles?.length)) {
        return pendingRoles;
      }

      if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) && userId > 0) {
        return await fetchUserRoles(userId, orgId);
      }
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
    return [];
  }, [orgId, userId, pendingRoles, roles]);

  useEffect(() => {
    // only load roles when there is an Org selected
    if (orgId) {
      getUserRoles();
    }
  }, [getUserRoles, orgId]);

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
      isLoading={loading || isLoading}
      disabled={disabled}
      basicRoleDisabled={basicRoleDisabled}
      basicRoleDisabledMessage={basicRoleDisabledMessage}
      showBasicRole
      apply={apply}
      canUpdateRoles={canUpdateRoles}
      maxWidth={maxWidth}
      width={width}
    />
  );
};
