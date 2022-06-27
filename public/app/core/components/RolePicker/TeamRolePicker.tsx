import React, { FC, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { Role } from 'app/types';

import { RolePicker } from './RolePicker';
// @ts-ignore
import { fetchTeamRoles, updateTeamRoles } from './api';

export interface Props {
  teamId: number;
  orgId?: number;
  roleOptions: Role[];
  disabled?: boolean;
  builtinRolesDisabled?: boolean;
}

export const TeamRolePicker: FC<Props> = ({ teamId, orgId, roleOptions, disabled, builtinRolesDisabled }) => {
  const [{ loading, value: appliedRoles = [] }, getTeamRoles] = useAsyncFn(async () => {
    try {
      return await fetchTeamRoles(teamId, orgId);
    } catch (e) {
      // TODO handle error
      console.error('Error loading options');
    }
    return [];
  }, [orgId, teamId]);

  useEffect(() => {
    getTeamRoles();
  }, [orgId, teamId, getTeamRoles]);

  const onRolesChange = async (roles: Role[]) => {
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
