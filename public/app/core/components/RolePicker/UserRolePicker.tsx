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

  // Determine when to fetch:
  // - In apply mode: only fetch if we don't have roles prop AND no pendingRoles (prevents flicker)
  // - In non-apply mode: always fetch to get fresh data after mutations
  const shouldFetch = apply ? !roles && !Boolean(pendingRoles?.length) && hasPermission : hasPermission;

  const { data: fetchedRoles, isLoading: isFetching } = useFetchUserRolesQuery(
    shouldFetch ? { userId, orgId } : skipToken
  );

  const [updateUserRoles, { isLoading: isUpdating }] = useUpdateUserRolesMutation();

  const appliedRoles =
    useMemo(() => {
      // In apply mode: prioritize pendingRoles, then roles prop (never use fetched data to prevent flicker)
      if (apply) {
        return pendingRoles || roles || [];
      }
      // In non-apply mode: prefer fetched data (fresh from cache) over roles prop
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
