import { getBackendSrv } from '@grafana/runtime';
import { ThunkResult } from 'app/types/store';

import { teamGroupsLoaded } from './reducers';

export function loadTeamGroups(teamUid: string): ThunkResult<void> {
  return async (dispatch) => {
    const response = await getBackendSrv().get(`/api/teams/${teamUid}/groups`);
    dispatch(teamGroupsLoaded(response));
  };
}

export function addTeamGroup(teamUid: string, groupId: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post(`/api/teams/${teamUid}/groups`, { groupId: groupId });
    dispatch(loadTeamGroups(teamUid));
  };
}

export function removeTeamGroup(teamUid: string, groupId: string): ThunkResult<void> {
  return async (dispatch) => {
    // need to use query parameter due to escaped characters in the request
    await getBackendSrv().delete(`/api/teams/${teamUid}/groups?groupId=${encodeURIComponent(groupId)}`);
    dispatch(loadTeamGroups(teamUid));
  };
}
