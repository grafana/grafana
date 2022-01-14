import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import { Role } from 'app/types';
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
  const [isLoading, setIsLoading] = useState(true);

  useAsync(async () => {
    try {
      let options = await (getRoleOptions ? getRoleOptions() : fetchRoleOptions(orgId));
      setRoleOptions(options.filter((option) => !option.name?.startsWith('managed:')));

      const teamRoles = await fetchTeamRoles(teamId, orgId);
      setAppliedRoles(teamRoles);
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    } finally {
      setIsLoading(false);
    }
  }, [getRoleOptions, orgId, teamId]);

  return (
    <RolePicker
      onRolesChange={(roles) => updateTeamRoles(roles, teamId, orgId)}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      isLoading={isLoading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
    />
  );
};
