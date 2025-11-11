import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';

import {
  useSearchTeamsQuery as useLegacySearchTeamsQuery,
  useCreateTeamMutation,
  useDeleteTeamByIdMutation,
  TeamDto,
  useListTeamsRolesQuery,
  CreateTeamCommand,
  useSetTeamRolesMutation,
  useGetTeamByIdQuery,
  useUpdateTeamMutation,
  UpdateTeamCommand,
} from 'app/api/clients/legacy';
import { updateNavIndex } from 'app/core/actions';
import { addFilteredDisplayName } from 'app/core/components/RolePicker/utils';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Role } from 'app/types/accessControl';
import { useDispatch } from 'app/types/store';

import { buildNavModel } from './state/navModel';

export type TeamWithRoles = TeamDto & {
  roles?: Role[];
};

const rolesEnabled =
  contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList);

export const useGetTeams = ({
  query,
  pageSize,
  page,
  sort,
}: {
  query?: string;
  pageSize?: number;
  page?: number;
  sort?: string;
}) => {
  const legacyResponse = useLegacySearchTeamsQuery({ perpage: pageSize, accesscontrol: true, page, sort, query });
  const teamIds = useMemo(() => {
    return (legacyResponse.data?.teams || []).map((team) => team.id).filter((id): id is number => id !== undefined);
  }, [legacyResponse.data?.teams]);
  const teamsRolesResponse = useListTeamsRolesQuery(teamIds.length ? { rolesSearchQuery: { teamIds } } : skipToken);

  const teamsWithRoles = useMemo(() => {
    if (rolesEnabled && teamsRolesResponse.isLoading) {
      return [];
    }
    return (legacyResponse.data?.teams || []).map((team) => {
      const roles = team.id ? teamsRolesResponse.data?.[team.id] || [] : [];
      const mappedRoles = roles.map((role) => addFilteredDisplayName(role));
      return {
        ...team,
        roles: mappedRoles,
      };
    });
  }, [legacyResponse, teamsRolesResponse]);

  return {
    ...legacyResponse,
    isLoading: legacyResponse.isLoading || teamsRolesResponse.isLoading,
    data: {
      teams: teamsWithRoles,
      totalCount: legacyResponse.data?.totalCount,
    },
  };
};

export const useGetTeam = ({ uid }: { uid: string }) => {
  const response = useGetTeamByIdQuery({ teamId: uid, accesscontrol: true });
  const dispatch = useDispatch();

  // TODO: Eventually remove and handle nav index logic elsewhere
  useEffect(() => {
    if (response.data) {
      dispatch(updateNavIndex(buildNavModel(response.data)));
    }
  }, [response.data, dispatch]);

  return response;
};

export const useUpdateTeam = () => {
  const [updateTeam, response] = useUpdateTeamMutation();

  const trigger = async ({ uid, team }: { uid: string; team: UpdateTeamCommand }) => {
    const mutationResult = await updateTeam({
      teamId: uid,
      updateTeamCommand: team,
    });

    return mutationResult;
  };

  return [trigger, response] as const;
};

export const useDeleteTeam = () => {
  const [deleteTeam, response] = useDeleteTeamByIdMutation();

  return [(uid: string) => deleteTeam({ teamId: uid }), response] as const;
};

const canUpdateRoles = () =>
  contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
  contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

export const useCreateTeam = () => {
  const [createTeam, response] = useCreateTeamMutation();
  const [setTeamRoles] = useSetTeamRolesMutation();

  const trigger = async (team: CreateTeamCommand, pendingRoles?: Role[]) => {
    const mutationResult = await createTeam({
      createTeamCommand: team,
    });

    const { data } = mutationResult;

    if (data && data.teamId && pendingRoles && pendingRoles.length) {
      await contextSrv.fetchUserPermissions();
      if (contextSrv.licensedAccessControlEnabled() && canUpdateRoles()) {
        await setTeamRoles({
          teamId: data.teamId,
          setTeamRolesCommand: {
            roleUids: pendingRoles.map((role) => role.uid),
          },
        });
      }
    }

    return mutationResult;
  };

  return [trigger, response] as const;
};
