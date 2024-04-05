import { isEqual } from 'lodash';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { contextSrv } from 'app/core/core';
import { Role, AccessControlAction } from 'app/types';

import { GenericRolePickerProps, RolePicker } from './RolePicker';
import { fetchTeamRoles, updateTeamRoles } from './api';

export interface TeamRolePickerProps extends GenericRolePickerProps {
  // Local props
  teamId: number;
  // TODO: remove these two and implement the logic higher up
  apply?: boolean;
  onApplyRoles?: (newRoles: Role[]) => void;
  pendingRoles?: Role[];
}

export const TeamRolePicker = ({
  // RolePicker props
  currentRoles,
  isLoading,
  apply = false,
  // Local props
  teamId,
  // TODO: remove these two
  onApplyRoles,
  pendingRoles,
  ...rolePickerProps
}: TeamRolePickerProps) => {
  const [teamRolesState, getTeamRoles] = useAsyncFn(async () => {
    try {
      if (isEqual(currentRoles, teamRolesState.value)) {
        if (apply && Boolean(pendingRoles?.length)) {
          return pendingRoles;
        }
      }

      if (contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList) && teamId > 0) {
        return await fetchTeamRoles(teamId);
      }
    } catch (e) {
      console.error('Error loading options', e);
    }
    return [];
  }, [teamId, pendingRoles, currentRoles]);

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

  if (apply) {
    rolePickerProps.submitButtonText = 'Apply';
  }

  return (
    <RolePicker
      onRolesChange={onRolesChange}
      currentRoles={teamRolesState.value || []}
      isLoading={teamRolesState.loading || isLoading}
      basicRoleDisabled={true}
      canUpdateRoles={canUpdateRoles}
      {...rolePickerProps}
    />
  );
};
