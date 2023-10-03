import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { FetchDataArgs } from '@grafana/ui';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { OrgUser } from 'app/types';

import { ThunkResult } from '../../../types';

import { usersLoaded, pageChanged, usersFetchBegin, usersFetchEnd, searchQueryChanged, sortChanged } from './reducers';

export function loadUsers(): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      const { perPage, page, searchQuery, sort } = getState().users;
      const users = await getBackendSrv().get(
        `/api/org/users/search`,
        accessControlQueryParam({ perpage: perPage, page, query: searchQuery, sort })
      );
      dispatch(usersLoaded(users));
    } catch (error) {
      usersFetchEnd();
    }
  };
}

const fetchUsersWithDebounce = debounce((dispatch) => dispatch(loadUsers()), 300);

export function updateUser(user: OrgUser): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().patch(`/api/org/users/${user.userId}`, { role: user.role });
    dispatch(loadUsers());
  };
}

export function removeUser(userId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/org/users/${userId}`);
    dispatch(loadUsers());
  };
}

export function changePage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(usersFetchBegin());
    dispatch(pageChanged(page));
    dispatch(loadUsers());
  };
}

export function changeSort({ sortBy }: FetchDataArgs<OrgUser>): ThunkResult<void> {
  const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
  return async (dispatch) => {
    dispatch(usersFetchBegin());
    dispatch(sortChanged(sort));
    dispatch(loadUsers());
  };
}

export function changeSearchQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(usersFetchBegin());
    dispatch(searchQueryChanged(query));
    fetchUsersWithDebounce(dispatch);
  };
}
