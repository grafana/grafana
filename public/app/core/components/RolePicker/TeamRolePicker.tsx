import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import { Role } from 'app/types';
import { RolePicker } from './RolePicker';
import { fetchTeamRoles, updateTeamRoles } from './api';

export interface Props {
  teamId: number;
  orgId?: number;
  roleOptions: Role[];
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
}

export const TeamRolePicker: FC<Props> = ({ teamId, orgId, roleOptions, disabled, builtinRolesDisabled }) => {
  const [appliedRoles, setAppliedRoles] = useState<Role[]>([]);

  const getTeamRoles = async () => {
    try {
      const teamRoles = await fetchTeamRoles(teamId, orgId);
      setAppliedRoles(teamRoles);
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
  };

  const { loading } = useAsync(getTeamRoles, [orgId, teamId]);

  const onRolesChange = async (roles: string[]) => {
    await updateTeamRoles(roles, teamId, orgId);
    await getTeamRoles();
  };

  return (
    <RolePicker
      onRolesChange={onRolesChange}
      roleOptions={roleOptions}
      appliedRoles={appliedRoles}
      isLoading={loading}
      disabled={disabled}
      builtinRolesDisabled={builtinRolesDisabled}
    />
  );
};
