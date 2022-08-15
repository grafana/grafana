import React, { FC, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types';

import { RolePicker } from './RolePicker';
// @ts-ignore
import { fetchTeamRoles, updateTeamRoles } from './api';

export interface Props {
  teamId: number;
  orgId?: number;
  roleOptions: Role[];
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
  onApplyRoles?: (newRoles: Role[]) => void;
  pendingRoles?: Role[];
  apply?: boolean;
}

export const TeamRolePicker: FC<Props> = ({
  teamId,
  roleOptions,
  disabled,
  builtinRolesDisabled = false,
  onApplyRoles,
  pendingRoles,
  apply = false,
}) => {
  const [{ loading, value: appliedRoles = [] }, getTeamRoles] = useAsyncFn(async () => {
    try {
      if (apply) {
        if (pendingRoles?.length! > 0) {
          return pendingRoles;
        }
      }
      return await fetchTeamRoles(teamId);
    } catch (e) {
      console.error(e);
    }
    return [];
  }, [teamId, pendingRoles]);

  useEffect(() => {
    // if (orgId) {
    getTeamRoles();
    // }
  }, [teamId, getTeamRoles, pendingRoles]);

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
      onRolesChange={onRolesChange}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      isLoading={loading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
      canUpdateRoles={canUpdateRoles}
      apply
    />
  );
};
