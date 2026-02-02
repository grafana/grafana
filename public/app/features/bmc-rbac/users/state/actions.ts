import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { ThunkResult } from 'app/types';

import {
  usersLoaded,
  usersFetchBegin,
  usersFetchEnd,
  searchQueryChanged,
  userFilterChanged,
  CheckStatusChanged,
  SelectAllStatusChanged,
  ClearState,
} from './reducers';

export function loadUsers(roleId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      const { searchQuery, showSelected } = getState().rbacUsers;
      const users = await getBackendSrv().get('/api/rbac/users', {
        bhdRoleId: roleId,
        selected: showSelected,
        query: searchQuery,
      });

      dispatch(usersLoaded({ users, roleId }));
    } finally {
      usersFetchEnd();
    }
  };
}

export function checkStatusChanged(checked: boolean, userId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(CheckStatusChanged({ checked, userId }));
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

export function postUsers(roleId: number, usersAdded: number[], usersRemoved: number[]) {
  return getBackendSrv().post(`/api/rbac/roles/${roleId}/users`, { usersAdded, usersRemoved });
}

const fetchUsersWithDebounce = debounce((dispatch, roleId) => dispatch(loadUsers(roleId)), 300);

export function changeSearchQuery(query: string, roleId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(usersFetchBegin());
    dispatch(searchQueryChanged(query));
    fetchUsersWithDebounce(dispatch, roleId);
  };
}

export function changeUserFilter(filter: string, roleId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    dispatch(usersFetchBegin());
    dispatch(userFilterChanged(filter));
    fetchUsersWithDebounce(dispatch, roleId);
  };
}
