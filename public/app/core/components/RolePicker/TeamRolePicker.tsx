import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role } from 'app/types';
import { RolePicker } from './RolePicker';
import { fetchRoleOptions, fetchTeamRoles, updateTeamRoles } from './api';

export interface Props {
  teamId: number;
  orgId?: number;
  getRoleOptions?: () => Promise<Role[]>;
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
}

export const TeamRolePicker: FC<Props> = ({ teamId, orgId, getRoleOptions, disabled, builtinRolesDisabled }) => {
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);
  const [appliedRoles, setAppliedRoles] = useState<Role[]>([]);

  const { loading } = useAsync(async () => {
    try {
      if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
        let options = await (getRoleOptions ? getRoleOptions() : fetchRoleOptions(orgId));
        setRoleOptions(options.filter((option) => !option.name?.startsWith('managed:')));
      } else {
        setRoleOptions([]);
      }

      const teamRoles = await fetchTeamRoles(teamId, orgId);
      setAppliedRoles(teamRoles);
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
  }, [getRoleOptions, orgId, teamId]);

  return (
    <RolePicker
      onRolesChange={(roles) => updateTeamRoles(roles, teamId, orgId)}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      isLoading={loading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
    />
  );
};
