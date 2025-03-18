import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { FetchDataArgs } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { OrgUser } from 'app/types';

import { AccessControlAction, ThunkResult } from '../../../types';

import {
  usersLoaded,
  pageChanged,
  usersFetchBegin,
  usersFetchEnd,
  searchQueryChanged,
  sortChanged,
  rolesFetchBegin,
  rolesFetchEnd,
} from './reducers';

export function loadUsers(): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      dispatch(usersFetchBegin());
      const { perPage, page, searchQuery, sort } = getState().users;
      const users = await getBackendSrv().get(
        `/api/org/users/search`,
        accessControlQueryParam({ perpage: perPage, page, query: searchQuery, sort })
      );

      if (
        contextSrv.licensedAccessControlEnabled() &&
        contextSrv.hasPermission(AccessControlAction.ActionUserRolesList)
      ) {
        dispatch(rolesFetchBegin());
        const orgId = contextSrv.user.orgId;
        const userIds = users?.orgUsers.map((u: OrgUser) => u.userId);
        const roles = await getBackendSrv().post(`/api/access-control/users/roles/search?includeMapped=true`, {
          userIds,
          orgId,
        });
        users.orgUsers.forEach((u: OrgUser) => {
          u.roles = roles ? roles[u.userId] || [] : [];
        });
        dispatch(rolesFetchEnd());
      }
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
    dispatch(pageChanged(page));
    dispatch(loadUsers());
  };
}

export function changeSort({ sortBy }: FetchDataArgs<OrgUser>): ThunkResult<void> {
  const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
  return async (dispatch) => {
    dispatch(sortChanged(sort));
    dispatch(loadUsers());
  };
}

export function changeSearchQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(searchQueryChanged(query));
    fetchUsersWithDebounce(dispatch);
  };
}
