import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { ThunkResult } from 'app/types';

import {
  teamsLoaded,
  teamsFetchBegin,
  teamsFetchEnd,
  searchQueryChanged,
  teamFilterChanged,
  CheckStatusChanged,
  SelectAllStatusChanged,
  ClearState,
} from './reducers';

export function loadTeams(roleId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      const { searchQuery, showSelected } = getState().rbacTeams;
      const teams = await getBackendSrv().get('/api/rbac/teams', {
        bhdRoleId: roleId,
        selected: showSelected,
        query: searchQuery,
      });

      dispatch(teamsLoaded({ teams, roleId }));
    } finally {
      teamsFetchEnd();
    }
  };
}

export function checkStatusChanged(checked: boolean, teamId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(CheckStatusChanged({ checked, teamId }));
  };
}
export function selectAllStatusChanged(checked: boolean, roleId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(SelectAllStatusChanged({ checked, roleId }));
  };
}
export function clearState(): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(ClearState());
  };
}

export function postTeams(roleId: number, teamsAdded: number[], teamsRemoved: number[]) {
  return getBackendSrv().post(`/api/rbac/roles/${roleId}/teams`, { teamsAdded, teamsRemoved });
}

const fetchTeamsWithDebounce = debounce((dispatch, roleId) => dispatch(loadTeams(roleId)), 300);

export function changeSearchQuery(query: string, roleId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(teamsFetchBegin());
    dispatch(searchQueryChanged(query));
    fetchTeamsWithDebounce(dispatch, roleId);
  };
}

export function changeTeamFilter(filter: string, roleId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(teamsFetchBegin());
    dispatch(teamFilterChanged(filter));
    fetchTeamsWithDebounce(dispatch, roleId);
  };
}
