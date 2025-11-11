import { getBackendSrv } from '@grafana/runtime';
import { ThunkResult } from 'app/types/store';

import { teamGroupsLoaded } from './reducers';

export function updateTeam(name: string, email: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const team = getStore().team.team;
    await getBackendSrv().put(`/api/teams/${team.uid}`, { name, email });
  };
}

export function loadTeamGroups(teamUid: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const response = await getBackendSrv().get(`/api/teams/${teamUid}/groups`);
    dispatch(teamGroupsLoaded(response));
  };
}

export function addTeamGroup(teamUid: string, groupId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    await getBackendSrv().post(`/api/teams/${teamUid}/groups`, { groupId: groupId });
    dispatch(loadTeamGroups(teamUid));
  };
}

export function removeTeamGroup(teamUid: string, groupId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    // need to use query parameter due to escaped characters in the request
    await getBackendSrv().delete(`/api/teams/${teamUid}/groups?groupId=${encodeURIComponent(groupId)}`);
    dispatch(loadTeamGroups(teamUid));
  };
}
