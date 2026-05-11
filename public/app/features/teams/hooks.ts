import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo } from 'react';

import { config } from '@grafana/runtime';
import {
  API_GROUP,
  API_VERSION,
  type GetTeamApiArg,
  type Team,
  useLazyGetSearchTeamsQuery as useLazyGetSearchTeamsQueryIam,
  useLazyGetTeamQuery as useLazyGetTeamQueryIam,
  useGetTeamQuery as useGetTeamQueryIam,
} from 'app/api/clients/iam/v0alpha1';
import {
  type TeamDto,
  type UpdateTeamCommand,
  useDeleteTeamByIdMutation,
  useGetTeamByIdQuery,
  useLazyGetTeamByIdQuery as useLazyGetTeamByIdQueryLegacy,
  useLazySearchTeamsQuery as useLazySearchTeamsQueryLegacy,
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

/**
 * Transform a legacy TeamDto to the IAM Team (k8s) shape.
 */
export function teamDtoToTeam(dto: TeamDto): Team {
  return {
    apiVersion: `${API_GROUP}/${API_VERSION}`,
    kind: 'Team',
    metadata: {
      name: dto.uid,
      creationTimestamp: '',
    },
    spec: {
      title: dto.name,
      email: dto.email ?? '',
      externalUID: dto.externalUID ?? '',
      provisioned: dto.isProvisioned,
      // FIXME: Legacy API does not return team members, so this will always be an empty array. We should either update the legacy API to include members or make a separate call to fetch them.
      members: [],
    },
  };
}

/**
 * Transform legacy TeamDto[] to IAM search hit shape.
 */
export function legacySearchToIamSearchHits(teams: TeamDto[]): Array<{ title: string; name: string }> {
  return teams.map((t) => ({ title: t.name, name: t.uid }));
}

const appPlatformIamEnabled = () => Boolean(config.featureToggles.kubernetesTeamsApi);

/**
 * Facade hook: get a team by UID, using IAM or legacy endpoint based on feature toggle.
 */
export function useGetTeamByUidQuery(args: GetTeamApiArg | typeof skipToken) {
  const enabled = appPlatformIamEnabled();

  const iamResult = useGetTeamQueryIam(enabled ? args : skipToken);
  const legacyResult = useGetTeamByIdQuery(!enabled && args !== skipToken ? { teamId: args.name } : skipToken);

  if (enabled) {
    return iamResult;
  }

  return {
    ...legacyResult,
    data: legacyResult.data ? teamDtoToTeam(legacyResult.data) : undefined,
  };
}

/**
 * Calls either the IAM or legacy get team by UID endpoint based on the feature toggle.
 */
export function useLazyGetTeamByUidQuery() {
  const enabled = appPlatformIamEnabled();
  const [iamTrigger, iamResult] = useLazyGetTeamQueryIam();
  const [legacyTrigger, legacyResult] = useLazyGetTeamByIdQueryLegacy();

  const iamTriggerer = useCallback(
    (args: GetTeamApiArg, preferCacheValue?: boolean) => iamTrigger(args, preferCacheValue),
    [iamTrigger]
  );

  const legacyTriggerer = useCallback(
    (args: GetTeamApiArg, preferCacheValue?: boolean) =>
      legacyTrigger({ teamId: args.name }, preferCacheValue).then((result) => ({
        ...result,
        data: result.data ? teamDtoToTeam(result.data) : undefined,
      })),
    [legacyTrigger]
  );

  if (enabled) {
    return [iamTriggerer, iamResult] as const;
  }

  return [
    legacyTriggerer,
    {
      ...legacyResult,
      data: legacyResult.data ? teamDtoToTeam(legacyResult.data) : undefined,
    },
  ] as const;
}

/**
 * Calls either the IAM or legacy search teams endpoint based on the feature toggle.
 */
export function useLazySearchTeamsQuery() {
  const enabled = appPlatformIamEnabled();
  const [iamTrigger, iamResult] = useLazyGetSearchTeamsQueryIam();
  const [legacyTrigger, legacyResult] = useLazySearchTeamsQueryLegacy();

  const legacyTriggerWrapped = (args: { query?: string }, preferCacheValue?: boolean) =>
    legacyTrigger({ query: args.query }, preferCacheValue).then((result) => ({
      ...result,
      data: result.data
        ? { hits: legacySearchToIamSearchHits(result.data.teams ?? []), totalHits: result.data.totalCount ?? 0 }
        : undefined,
    }));

  if (enabled) {
    return [iamTrigger, iamResult] as const;
  }

  return [legacyTriggerWrapped, legacyResult] as const;
}
