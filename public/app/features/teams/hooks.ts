import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo } from 'react';

import {
  useCreateExternalGroupMappingMutation,
  useListExternalGroupMappingQuery,
  useDeleteExternalGroupMappingMutation,
} from '@grafana/api-clients/rtkq/iam/v0alpha1';
import {
  useAddTeamGroupApiMutation,
  useGetTeamGroupsApiQuery,
  useRemoveTeamGroupApiQueryMutation,
  TeamGroupDto,
} from '@grafana/api-clients/rtkq/legacy';
import { config } from '@grafana/runtime';
import {
  useSearchTeamsQuery as useLegacySearchTeamsQuery,
  useCreateTeamMutation,
  useDeleteTeamByIdMutation,
  useListTeamsRolesQuery,
  CreateTeamCommand,
  useSetTeamRolesMutation,
  useGetTeamByIdQuery,
  useUpdateTeamMutation,
  UpdateTeamCommand,
} from 'app/api/clients/legacy';
import { updateNavIndex } from 'app/core/actions';
import { addFilteredDisplayName } from 'app/core/components/RolePicker/utils';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, Role } from 'app/types/accessControl';
import { useDispatch } from 'app/types/store';

import { buildNavModel } from './state/navModel';

const rolesEnabled =
  contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList);

const canUpdateRoles = () =>
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

/**
 * Create a new team, and link any pending roles
 */
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

export const useGetExternalGroupMappings = (args: { teamId: string }) => {
  const shouldUseAppPlatform = Boolean(config.featureToggles.kubernetesExternalGroupMapping);

  const legacyResult = useGetTeamGroupsApiQuery(args, { skip: shouldUseAppPlatform });

  const { data: newApiData, ...newApiRest } = useListExternalGroupMappingQuery({}, { skip: !shouldUseAppPlatform });

  const groups: TeamGroupDto[] = useMemo(() => {
    // FIXME: Consider using the search API which has sorting support
    return (newApiData?.items || [])
      .filter((item) => item.spec.teamRef.name === args.teamId)
      .map((item) => ({
        groupId: item.spec.externalGroupId,
        uid: item.metadata.name,
      }));
  }, [newApiData, args.teamId]);

  if (shouldUseAppPlatform) {
    return {
      ...newApiRest,
      data: groups,
    };
  }
  return legacyResult;
};

export const useAddExternalGroupMapping = () => {
  const legacyMutation = useAddTeamGroupApiMutation();

  const [addNew, newResult] = useCreateExternalGroupMappingMutation();

  const add = async (args: { teamId: string; teamGroupMapping: { groupId: string } }) => {
    return addNew({
      externalGroupMapping: {
        metadata: {
          generateName: 'external-group-mapping-',
        },
        spec: {
          externalGroupId: args.teamGroupMapping.groupId,
          teamRef: {
            name: args.teamId,
          },
        },
      },
    });
  };

  if (!config.featureToggles.kubernetesExternalGroupMapping) {
    return legacyMutation;
  }
  return [add, newResult] as const;
};

export const useRemoveExternalGroupMapping = () => {
  const legacyMutation = useRemoveTeamGroupApiQueryMutation();

  const [deleteMapping, deleteResult] = useDeleteExternalGroupMappingMutation();

  const remove = async (args: { teamId: string; groupId: string; uid: string }) => {
    return deleteMapping({ name: args.uid });
  };

  if (!config.featureToggles.kubernetesExternalGroupMapping) {
    return legacyMutation;
  }
  return [remove, deleteResult] as const;
};
