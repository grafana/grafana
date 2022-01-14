import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';
import { RolePicker } from './RolePicker';

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

export const fetchRoleOptions = async (orgId?: number, query?: string): Promise<Role[]> => {
  let rolesUrl = '/api/access-control/roles?delegatable=true';
  if (orgId) {
    rolesUrl += `&targetOrgId=${orgId}`;
  }
  const roles = await getBackendSrv().get(rolesUrl);
  if (!roles || !roles.length) {
    return [];
  }
  return roles;
};

export const fetchBuiltinRoles = (orgId?: number): Promise<{ [key: string]: Role[] }> => {
  let builtinRolesUrl = '/api/access-control/builtin-roles';
  if (orgId) {
    builtinRolesUrl += `?targetOrgId=${orgId}`;
  }
  return getBackendSrv().get(builtinRolesUrl);
};

export const fetchTeamRoles = async (teamId: number, orgId?: number): Promise<Role[]> => {
  let teamRolesUrl = `/api/access-control/teams/${teamId}/roles`;
  if (orgId) {
    teamRolesUrl += `?targetOrgId=${orgId}`;
  }
  try {
    const roles = await getBackendSrv().get(teamRolesUrl);
    if (!roles || !roles.length) {
      return [];
    }
    return roles;
  } catch (error) {
    error.isHandled = true;
    return [];
  }
};

export const updateTeamRoles = (roleUids: string[], teamId: number, orgId?: number) => {
  let teamRolesUrl = `/api/access-control/teams/${teamId}/roles`;
  if (orgId) {
    teamRolesUrl += `?targetOrgId=${orgId}`;
  }
  return getBackendSrv().put(teamRolesUrl, {
    orgId,
    roleUids,
  });
};
