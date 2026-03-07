import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';

import {
  UpdateTeamCommand,
  useDeleteTeamByIdMutation,
  useGetTeamByIdQuery,
  useSearchTeamsQuery as useLegacySearchTeamsQuery,
  useListTeamsRolesQuery,
  useUpdateTeamMutation,
} from 'app/api/clients/legacy';
import { updateNavIndex } from 'app/core/reducers/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { addFilteredDisplayName } from 'app/core/utils/roles';
import { AccessControlAction } from 'app/types/accessControl';
import { useDispatch } from 'app/types/store';

import { buildNavModel } from './state/navModel';

const rolesEnabled =
  contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList);

export const canUpdateRoles = () =>
  contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
  contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);

/**
 * Get list of teams and their associated roles (if roles are enabled)
 */
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
    const teams = legacyResponse.data?.teams || [];
    const ids = teams.map((team) => team.id);
    return ids.filter((id): id is number => id !== undefined);
  }, [legacyResponse.data?.teams]);

  const teamsRolesResponse = useListTeamsRolesQuery(
    rolesEnabled && teamIds.length ? { rolesSearchQuery: { teamIds } } : skipToken
  );

  const teamsWithRoles = useMemo(() => {
    if (!rolesEnabled || (rolesEnabled && teamsRolesResponse.isLoading)) {
      return legacyResponse.data?.teams || [];
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
    isLoading: legacyResponse.isLoading || (rolesEnabled ? teamsRolesResponse.isLoading : false),
    data: {
      teams: teamsWithRoles,
      totalCount: legacyResponse.data?.totalCount,
    },
  };
};

/**
 * Get a single team by UID
 */
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

/**
 * Update a team by UID
 */
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

/**
 * Delete a team by UID
 */
export const useDeleteTeam = () => {
  const [deleteTeam, response] = useDeleteTeamByIdMutation();

  return [({ uid }: { uid: string }) => deleteTeam({ teamId: uid }), response] as const;
};
