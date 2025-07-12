import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types/accessControl';

import { RolePicker } from './RolePicker';
import { fetchTeamRoles, updateTeamRoles } from './api';

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
  const [{ loading, value: appliedRoles = roles || [] }, getTeamRoles] = useAsyncFn(async () => {
    try {
      if (roles) {
        return roles;
      }
      if (apply && Boolean(pendingRoles?.length)) {
        return pendingRoles;
      }

      if (contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList) && teamId > 0) {
        return await fetchTeamRoles(teamId);
      }
    } catch (e) {
      console.error('Error loading options', e);
    }
    return [];
  }, [teamId, pendingRoles, roles]);

  useEffect(() => {
    getTeamRoles();
  }, [getTeamRoles]);

  const onRolesChange = async (roles: Role[]) => {
    if (!apply) {
      await updateTeamRoles(roles, teamId);
      await getTeamRoles();
    } else if (onApplyRoles) {
      onApplyRoles(roles);
    }
  };

  const canUpdateRoles =
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
    contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);

  return (
    <RolePicker
      apply={apply}
      onRolesChange={onRolesChange}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      isLoading={loading || isLoading}
      disabled={disabled}
      basicRoleDisabled={true}
      canUpdateRoles={canUpdateRoles}
      maxWidth={maxWidth}
      width={width}
    />
  );
};
