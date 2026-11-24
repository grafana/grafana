import { skipToken } from '@reduxjs/toolkit/query';

import { type OrgRole } from '@grafana/data';
import { useListUserRolesQuery, useSetUserRolesMutation } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, type Role } from 'app/types/accessControl';

import { RolePicker } from './RolePicker';

// One instance, so that the picker does not take each render for a change of the applied roles.
const noRoles: Role[] = [];

export interface Props {
  basicRole: OrgRole;
  roles?: Role[];
  userId: number;
  orgId?: number;
  onBasicRoleChange: (newRole: OrgRole) => void | Promise<unknown>;
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
  /**
   * Receives the pending roles write (apply=false), so that the caller can report its outcome.
   * Without it a failed write is only logged.
   */
  onRolesUpdate?: (update: Promise<unknown>) => void;
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
  onRolesUpdate,
}: Props) => {
  const hasPermission = contextSrv.hasPermission(AccessControlAction.ActionUserRolesList) && userId > 0 && orgId;

  // Determine when to fetch:
  // - In apply mode: only fetch if we don't have roles prop AND no pendingRoles (prevents flicker)
  // - In non-apply mode: always fetch to get fresh data after mutations
  const shouldFetch = apply ? !roles && !Boolean(pendingRoles?.length) && hasPermission : hasPermission;

  const {
    data: fetchedRoles,
    isLoading: isFetching,
    isSuccess: rolesRead,
  } = useListUserRolesQuery(
    shouldFetch ? { userId, includeHidden: true, includeMapped: true, targetOrgId: orgId } : skipToken
  );

  const [updateUserRoles, { isLoading: isUpdating }] = useSetUserRolesMutation();

  // In apply mode: prioritize pendingRoles, then roles prop (never use fetched data to prevent flicker)
  // In non-apply mode: prefer fetched data (fresh from cache) over roles prop
  const appliedRoles = (apply ? pendingRoles || roles : fetchedRoles || roles) ?? noRoles;

  const onRolesChange = async (newRoles: Role[]) => {
    if (apply) {
      onApplyRoles?.(newRoles, userId, orgId);
      return;
    }
    const roleUids = newRoles.filter((role) => !role.mapped).map((role) => role.uid);
    const update = updateUserRoles({ userId, targetOrgId: orgId, setUserRolesCommand: { roleUids } }).unwrap();
    onRolesUpdate?.(update);
    try {
      await update;
    } catch (error) {
      if (!onRolesUpdate) {
        console.error('Error updating user roles', error);
      }
      // Rethrown so that the picker drops the selection the server refused.
      throw error;
    }
  };

  // A roles update replaces the whole set, so it needs the set as the server last returned it. While
  // that loads, or after a failed read, an update would remove every role that is not shown.
  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove) &&
    (apply || rolesRead);

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
