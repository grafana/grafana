import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useFetchTeamRolesQuery, useUpdateTeamRolesMutation } from 'app/api/clients/roles';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role } from 'app/types/accessControl';

import { RolePicker } from './RolePicker';

export interface Props {
  teamId: number;
  orgId?: number;
  roleOptions: Role[];
  disabled?: boolean;
  roles?: Role[];
  onApplyRoles?: (newRoles: Role[]) => void;
  pendingRoles?: Role[];
  /**
   * Set whether the component should send a request with the new roles to the
   * backend in TeamRolePicker.onRolesChange (apply=false), or call {@link onApplyRoles}
   * with the updated list of roles (apply=true).
   *
   * Besides it sets the RolePickerMenu's Button title to
   *   * `Update` in case apply equals false
   *   * `Apply` in case apply equals true
   *
   * @default false
   */
  apply?: boolean;
  maxWidth?: string | number;
  width?: string | number;
  isLoading?: boolean;
}

export const TeamRolePicker = ({
  teamId,
  roleOptions,
  disabled,
  roles,
  onApplyRoles,
  pendingRoles,
  apply = false,
  maxWidth,
  width,
  isLoading,
}: Props) => {
  const hasPermission = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList) && teamId > 0;

  // In non-apply mode, always fetch to ensure we have fresh data after mutations
  // In apply mode, only skip fetch if we have pendingRoles
  const shouldFetch = apply ? !Boolean(pendingRoles?.length) && hasPermission : hasPermission;

  const { data: fetchedRoles, isLoading: isFetching } = useFetchTeamRolesQuery(shouldFetch ? { teamId } : skipToken);

  const [updateTeamRoles, { isLoading: isUpdating }] = useUpdateTeamRolesMutation();

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
        await updateTeamRoles({ teamId, roles: newRoles }).unwrap();
      } catch (error) {
        console.error('Error updating team roles', error);
      }
    } else if (onApplyRoles) {
      onApplyRoles(newRoles);
    }
  };

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  return (
    <RolePicker
      pickerId={`team-picker-${teamId}`}
      apply={apply}
      onRolesChange={onRolesChange}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      isLoading={isFetching || isUpdating || isLoading}
      disabled={disabled}
      basicRoleDisabled={true}
      canUpdateRoles={canUpdateRoles}
      maxWidth={maxWidth}
      width={width}
    />
  );
};
