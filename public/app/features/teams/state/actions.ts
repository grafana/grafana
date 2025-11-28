import { debounce } from 'lodash';

import { VersionsV0Alpha1Kinds7RoutesGroupsGetResponseExternalGroupMapping } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { config, getBackendSrv } from '@grafana/runtime';
import { FetchDataArgs } from '@grafana/ui';
import { iamAPIv0alpha1 } from 'app/api/clients/iam/v0alpha1';
import { updateNavIndex } from 'app/core/actions';
import { contextSrv } from 'app/core/services/context_srv';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { AccessControlAction } from 'app/types/accessControl';
import { ThunkResult } from 'app/types/store';
import { Team, TeamGroup, TeamWithRoles } from 'app/types/teams';

import { buildNavModel } from './navModel';
import {
  teamGroupsLoaded,
  queryChanged,
  pageChanged,
  teamLoaded,
  teamsLoaded,
  sortChanged,
  rolesFetchBegin,
  rolesFetchEnd,
} from './reducers';

export function loadTeams(initial = false): ThunkResult<void> {
  return async (dispatch, getState) => {
    const { query, page, perPage, sort } = getState().teams;
    // Early return if the user cannot list teams
    if (!contextSrv.hasPermission(AccessControlAction.ActionTeamsRead)) {
      dispatch(teamsLoaded({ teams: [], totalCount: 0, page: 1, perPage, noTeams: true }));
      return;
    }

    const response = await getBackendSrv().get(
      '/api/teams/search',
      accessControlQueryParam({ query, page, perpage: perPage, sort })
    );

    // We only want to check if there is no teams on the initial request.
    // A query that returns no teams should not render the empty list banner.
    let noTeams = false;
    if (initial) {
      noTeams = response.teams.length === 0;
    }

    if (
      contextSrv.licensedAccessControlEnabled() &&
      contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList)
    ) {
      dispatch(rolesFetchBegin());
      const teamIds = response?.teams.map((t: TeamWithRoles) => t.id);
      const roles = await getBackendSrv().post(`/api/access-control/teams/roles/search`, { teamIds });
      response.teams.forEach((t: TeamWithRoles) => {
        t.roles = roles ? roles[t.id] || [] : [];
      });
      dispatch(rolesFetchEnd());
    }

    dispatch(teamsLoaded({ noTeams, ...response }));
  };
}

const loadTeamsWithDebounce = debounce((dispatch) => dispatch(loadTeams()), 500);

export function loadTeam(uid: string): ThunkResult<Promise<void>> {
  return async (dispatch) => {
    const response = await getBackendSrv().get(`/api/teams/${uid}`, accessControlQueryParam());
    dispatch(teamLoaded(response));
    dispatch(updateNavIndex(buildNavModel(response)));
  };
}

export function deleteTeam(uid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/teams/${uid}`);
    // Update users permissions in case they lost teams.read with the deletion
    await contextSrv.fetchUserPermissions();
    dispatch(loadTeams());
  };
}

export function changeQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(queryChanged(query));
    loadTeamsWithDebounce(dispatch);
  };
}

export function changePage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(pageChanged(page));
    dispatch(loadTeams());
  };
}

export function changeSort({ sortBy }: FetchDataArgs<Team>): ThunkResult<void> {
  const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
  return async (dispatch) => {
    dispatch(sortChanged(sort));
    dispatch(loadTeams());
  };
}

export function updateTeam(name: string, email: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().put(`/api/teams/${team.uid}`, { name, email });
    dispatch(loadTeam(team.uid));
  };
}

export function loadTeamGroups(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;

    if (config.featureToggles.kubernetesExternalGroupMapping) {
      const args = { name: team.uid };

      const data = await dispatch(
        iamAPIv0alpha1.endpoints.getTeamGroups.initiate(args, {
          forceRefetch: true,
        })
      ).unwrap();

      // Map to internal TeamGroup type
      const groups: TeamGroup[] =
        data?.items?.map((item: VersionsV0Alpha1Kinds7RoutesGroupsGetResponseExternalGroupMapping) => ({
          groupId: item.externalGroup,
          teamId: 0,
          uid: item.name,
        })) || [];

      dispatch(teamGroupsLoaded(groups));
    } else {
      const response = await getBackendSrv().get(`/api/teams/${team.uid}/groups`);
      dispatch(teamGroupsLoaded(response));
    }
  };
}

export function addTeamGroup(groupId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;

    if (config.featureToggles.kubernetesExternalGroupMapping) {
      await dispatch(
        iamAPIv0alpha1.endpoints.createExternalGroupMapping.initiate({
          externalGroupMapping: {
            apiVersion: 'iam.grafana.app/v0alpha1',
            kind: 'ExternalGroupMapping',
            metadata: {
              generateName: 'group-mapping-',
            },
            spec: {
              externalGroupId: groupId,
              teamRef: {
                name: team.uid,
              },
            },
          },
        })
      ).unwrap();
    } else {
      await getBackendSrv().post(`/api/teams/${team.uid}/groups`, { groupId: groupId });
    }

    dispatch(loadTeamGroups());
  };
}

export function removeTeamGroup(groupId: string, mappingUid: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;

    if (config.featureToggles.kubernetesExternalGroupMapping) {
      await dispatch(iamAPIv0alpha1.endpoints.deleteExternalGroupMapping.initiate({ name: mappingUid })).unwrap();
    } else {
      // need to use query parameter due to escaped characters in the request
      await getBackendSrv().delete(`/api/teams/${team.uid}/groups?groupId=${encodeURIComponent(groupId)}`);
    }

    dispatch(loadTeamGroups());
  };
}
