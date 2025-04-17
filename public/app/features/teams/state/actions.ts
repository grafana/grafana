import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { FetchDataArgs } from '@grafana/ui';
import { updateNavIndex } from 'app/core/actions';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { AccessControlAction, TeamWithRoles, TeamMember, ThunkResult, Team } from 'app/types';

import { buildNavModel } from './navModel';
import {
  teamGroupsLoaded,
  queryChanged,
  pageChanged,
  teamLoaded,
  teamMembersLoaded,
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

export function loadTeamMembers(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    const response = await getBackendSrv().get(`/api/teams/${team.uid}/members`);
    dispatch(teamMembersLoaded(response));
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
    const response = await getBackendSrv().get(`/api/teams/${team.uid}/groups`);
    dispatch(teamGroupsLoaded(response));
  };
}

export function addTeamGroup(groupId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().post(`/api/teams/${team.uid}/groups`, { groupId: groupId });
    dispatch(loadTeamGroups());
  };
}

export function removeTeamGroup(groupId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    // need to use query parameter due to escaped characters in the request
    await getBackendSrv().delete(`/api/teams/${team.uid}/groups?groupId=${encodeURIComponent(groupId)}`);
    dispatch(loadTeamGroups());
  };
}

export function updateTeamMember(member: TeamMember): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().put(`/api/teams/${member.teamId}/members/${member.userId}`, {
      permission: member.permission,
    });
    dispatch(loadTeamMembers());
  };
}
