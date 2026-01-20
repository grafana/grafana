import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { OrgRole } from '@grafana/data';
import { useFetchUserRolesQuery, useUpdateUserRolesMutation } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role } from 'app/types/accessControl';

import { RolePicker } from './RolePicker';

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
  const hasPermission = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) && userId > 0 && orgId;

  // In non-apply mode, always fetch to ensure we have fresh data after mutations
  // In apply mode, only skip fetch if we have pendingRoles
  const shouldFetch = apply ? !Boolean(pendingRoles?.length) && hasPermission : hasPermission;

  const { data: fetchedRoles, isLoading: isFetching } = useFetchUserRolesQuery(
    shouldFetch ? { userId, orgId } : skipToken
  );

  const [updateUserRoles, { isLoading: isUpdating }] = useUpdateUserRolesMutation();

  const appliedRoles =
    useMemo(() => {
      if (apply && Boolean(pendingRoles?.length)) {
        return pendingRoles;
      }
      // Otherwise prefer fetched data (which is always fresh due to cache invalidation)
      // Fall back to roles prop if fetched data is not available yet
      return fetchedRoles || roles || [];
    }, [roles, pendingRoles, fetchedRoles, apply]) || [];

  const onRolesChange = async (newRoles: Role[]) => {
    if (!apply) {
      try {
        await updateUserRoles({ userId, roles: newRoles, orgId }).unwrap();
      } catch (error) {
        console.error('Error updating user roles', error);
      }
    } else if (onApplyRoles) {
      onApplyRoles(newRoles, userId, orgId);
    }
  };

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

  return (
    <RolePicker
      pickerId={`user-picker-${userId}-${orgId}`}
      appliedRoles={appliedRoles}
      basicRole={basicRole}
      onRolesChange={onRolesChange}
      onBasicRoleChange={onBasicRoleChange}
      roleOptions={roleOptions}
      isLoading={isFetching || isUpdating || isLoading}
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
