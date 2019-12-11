import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '@grafana/runtime';
import { StoreState, Team, TeamGroup, TeamMember } from 'app/types';
import { updateNavIndex, UpdateNavIndexAction } from 'app/core/actions';
import { buildNavModel } from './navModel';

export enum ActionTypes {
  LoadTeams = 'LOAD_TEAMS',
  LoadTeam = 'LOAD_TEAM',
  SetSearchQuery = 'SET_TEAM_SEARCH_QUERY',
  SetSearchMemberQuery = 'SET_TEAM_MEMBER_SEARCH_QUERY',
  LoadTeamMembers = 'TEAM_MEMBERS_LOADED',
  LoadTeamGroups = 'TEAM_GROUPS_LOADED',
}

export interface LoadTeamsAction {
  type: ActionTypes.LoadTeams;
  payload: Team[];
}

export interface LoadTeamAction {
  type: ActionTypes.LoadTeam;
  payload: Team;
}

export interface LoadTeamMembersAction {
  type: ActionTypes.LoadTeamMembers;
  payload: TeamMember[];
}

export interface LoadTeamGroupsAction {
  type: ActionTypes.LoadTeamGroups;
  payload: TeamGroup[];
}

export interface SetSearchQueryAction {
  type: ActionTypes.SetSearchQuery;
  payload: string;
}

export interface SetSearchMemberQueryAction {
  type: ActionTypes.SetSearchMemberQuery;
  payload: string;
}

export type Action =
  | LoadTeamsAction
  | SetSearchQueryAction
  | LoadTeamAction
  | LoadTeamMembersAction
  | SetSearchMemberQueryAction
  | LoadTeamGroupsAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action | UpdateNavIndexAction>;

const teamsLoaded = (teams: Team[]): LoadTeamsAction => ({
  type: ActionTypes.LoadTeams,
  payload: teams,
});

const teamLoaded = (team: Team): LoadTeamAction => ({
  type: ActionTypes.LoadTeam,
  payload: team,
});

const teamMembersLoaded = (teamMembers: TeamMember[]): LoadTeamMembersAction => ({
  type: ActionTypes.LoadTeamMembers,
  payload: teamMembers,
});

const teamGroupsLoaded = (teamGroups: TeamGroup[]): LoadTeamGroupsAction => ({
  type: ActionTypes.LoadTeamGroups,
  payload: teamGroups,
});

export const setSearchMemberQuery = (searchQuery: string): SetSearchMemberQueryAction => ({
  type: ActionTypes.SetSearchMemberQuery,
  payload: searchQuery,
});

export const setSearchQuery = (searchQuery: string): SetSearchQueryAction => ({
  type: ActionTypes.SetSearchQuery,
  payload: searchQuery,
});

export function loadTeams(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/teams/search', { perpage: 1000, page: 1 });
    dispatch(teamsLoaded(response.teams));
  };
}

export function loadTeam(id: number): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get(`/api/teams/${id}`);
    dispatch(teamLoaded(response));
    dispatch(updateNavIndex(buildNavModel(response)));
  };
}

export function loadTeamMembers(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    const response = await getBackendSrv().get(`/api/teams/${team.id}/members`);
    dispatch(teamMembersLoaded(response));
  };
}

export function addTeamMember(id: number): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().post(`/api/teams/${team.id}/members`, { userId: id });
    dispatch(loadTeamMembers());
  };
}

export function removeTeamMember(id: number): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().delete(`/api/teams/${team.id}/members/${id}`);
    dispatch(loadTeamMembers());
  };
}

export function updateTeam(name: string, email: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().put(`/api/teams/${team.id}`, { name, email });
    dispatch(loadTeam(team.id));
  };
}

export function loadTeamGroups(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    const response = await getBackendSrv().get(`/api/teams/${team.id}/groups`);
    dispatch(teamGroupsLoaded(response));
  };
}

export function addTeamGroup(groupId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().post(`/api/teams/${team.id}/groups`, { groupId: groupId });
    dispatch(loadTeamGroups());
  };
}

export function removeTeamGroup(groupId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().delete(`/api/teams/${team.id}/groups/${encodeURIComponent(groupId)}`);
    dispatch(loadTeamGroups());
  };
}

export function deleteTeam(id: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().delete(`/api/teams/${id}`);
    dispatch(loadTeams());
  };
}

export function updateTeamMember(member: TeamMember): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().put(`/api/teams/${member.teamId}/members/${member.userId}`, {
      permission: member.permission,
    });
    dispatch(loadTeamMembers());
  };
}
