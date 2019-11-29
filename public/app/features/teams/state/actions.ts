import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '@grafana/runtime';
import { StoreState, TeamMember } from 'app/types';
import { updateNavIndex, UpdateNavIndexAction } from 'app/core/actions';
import { buildNavModel } from './navModel';
import { loadTeamAction, loadTeamGroupsAction, loadTeamMembersAction, loadTeamsAction } from './reducers';
import { PayloadAction } from '@reduxjs/toolkit';

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, PayloadAction<any> | UpdateNavIndexAction>;

export function loadTeams(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/teams/search', { perpage: 1000, page: 1 });
    dispatch(loadTeamsAction(response.teams));
  };
}

export function loadTeam(id: number): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get(`/api/teams/${id}`);
    dispatch(loadTeamAction(response));
    dispatch(updateNavIndex(buildNavModel(response)));
  };
}

export function loadTeamMembers(): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    const response = await getBackendSrv().get(`/api/teams/${team.id}/members`);
    dispatch(loadTeamMembersAction(response));
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
    dispatch(loadTeamGroupsAction(response));
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
