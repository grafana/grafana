import { debounce } from 'lodash';

import { featureEnabled, getBackendSrv, isFetchError } from '@grafana/runtime';
import { type FetchDataArgs } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type LdapUser } from 'app/types/ldap';
import { type ThunkResult } from 'app/types/store';
import { type UserDTO, type UserFilter, type AnonUserFilter } from 'app/types/user';

import {
  ldapConnectionInfoLoadedAction,
  ldapSyncStatusLoadedAction,
  userMappingInfoLoadedAction,
  userMappingInfoFailedAction,
  clearUserMappingInfoAction,
  clearUserErrorAction,
  ldapFailedAction,
  usersFetched,
  queryChanged,
  pageChanged,
  filterChanged,
  usersFetchBegin,
  usersFetchEnd,
  sortChanged,
  usersAnonymousDevicesFetched,
  anonUserSortChanged,
  anonPageChanged,
  anonQueryChanged,
} from './reducers';
// LDAP user actions

export function loadLdapSyncStatus(): ThunkResult<void> {
  return async (dispatch) => {
    // Available only in enterprise
    const canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
    if (featureEnabled('ldapsync') && canReadLDAPStatus) {
      const syncStatus = await getBackendSrv().get(`/api/admin/ldap-sync-status`);
      dispatch(ldapSyncStatusLoadedAction(syncStatus));
    }
  };
}

// LDAP debug page

export function loadLdapState(): ThunkResult<void> {
  return async (dispatch) => {
    if (!contextSrv.hasPermission(AccessControlAction.LDAPStatusRead)) {
      return;
    }

    try {
      const connectionInfo = await getBackendSrv().get(`/api/admin/ldap/status`);
      dispatch(ldapConnectionInfoLoadedAction(connectionInfo));
    } catch (error) {
      if (isFetchError(error)) {
        error.isHandled = true;
        const ldapError = {
          title: error.data.message,
          body: error.data.error,
        };
        dispatch(ldapFailedAction(ldapError));
      }
    }
  };
}

export function loadUserMapping(username: string): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const response = await getBackendSrv().get(`/api/admin/ldap/${encodeURIComponent(username)}`);
      const { name, surname, email, login, isGrafanaAdmin, isDisabled, roles, teams } = response;
      const userInfo: LdapUser = {
        info: { name, surname, email, login },
        permissions: { isGrafanaAdmin, isDisabled },
        roles,
        teams,
      };
      dispatch(userMappingInfoLoadedAction(userInfo));
    } catch (error) {
      if (isFetchError(error)) {
        error.isHandled = true;
        const userError = {
          title: error.data.message,
          body: error.data.error,
        };
        dispatch(clearUserMappingInfoAction());
        dispatch(userMappingInfoFailedAction(userError));
      }
    }
  };
}

export function clearUserError(): ThunkResult<void> {
  return (dispatch) => {
    dispatch(clearUserErrorAction());
  };
}

export function clearUserMappingInfo(): ThunkResult<void> {
  return (dispatch) => {
    dispatch(clearUserErrorAction());
    dispatch(clearUserMappingInfoAction());
  };
}

// UserListAdminPage

const getFilters = (filters: UserFilter[]) => {
  return filters
    .map((filter) => {
      if (Array.isArray(filter.value)) {
        return filter.value.map((v) => `${filter.name}=${v.value}`).join('&');
      }
      return `${filter.name}=${filter.value}`;
    })
    .join('&');
};

export function fetchUsers(): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      const { perPage, page, query, filters, sort } = getState().userListAdmin;
      let url = `/api/users/search?perpage=${perPage}&page=${page}&query=${query}&${getFilters(filters)}`;
      if (sort) {
        url += `&sort=${sort}`;
      }
      const result = await getBackendSrv().get(url);
      dispatch(usersFetched(result));
    } catch (error) {
      usersFetchEnd();
      console.error(error);
    }
  };
}

const fetchUsersWithDebounce = debounce((dispatch) => dispatch(fetchUsers()), 500);

export function changeQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(usersFetchBegin());
    dispatch(queryChanged(query));
    fetchUsersWithDebounce(dispatch);
  };
}

export function changeFilter(filter: UserFilter): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(usersFetchBegin());
    dispatch(filterChanged(filter));
    fetchUsersWithDebounce(dispatch);
  };
}

export function changePage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(usersFetchBegin());
    dispatch(pageChanged(page));
    dispatch(fetchUsers());
  };
}

export function changeSort({ sortBy }: FetchDataArgs<UserDTO>): ThunkResult<void> {
  const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
  return async (dispatch, getState) => {
    const currentSort = getState().userListAdmin.sort;
    if (currentSort !== sort) {
      dispatch(usersFetchBegin());
      dispatch(sortChanged(sort));
      dispatch(fetchUsers());
    }
  };
}

// UserListAnonymousPage
const getAnonFilters = (filters: AnonUserFilter[]) => {
  return filters
    .map((filter) => {
      if (Array.isArray(filter.value)) {
        return filter.value.map((v) => `${filter.name}=${v.value}`).join('&');
      }
      return `${filter.name}=${filter.value}`;
    })
    .join('&');
};

export function fetchUsersAnonymousDevices(): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      const { perPage, page, query, filters, sort } = getState().userListAnonymousDevices;
      let url = `/api/anonymous/search?perpage=${perPage}&page=${page}&query=${query}&${getAnonFilters(filters)}`;
      if (sort) {
        url += `&sort=${sort}`;
      }
      const result = await getBackendSrv().get(url);
      dispatch(usersAnonymousDevicesFetched(result));
    } catch (error) {
      console.error(error);
    }
  };
}

const fetchAnonUsersWithDebounce = debounce((dispatch) => dispatch(fetchUsersAnonymousDevices()), 500);

export function changeAnonUserSort({ sortBy }: FetchDataArgs<UserDTO>): ThunkResult<void> {
  const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
  return async (dispatch, getState) => {
    const currentSort = getState().userListAnonymousDevices.sort;
    if (currentSort !== sort) {
      // dispatch(usersFetchBegin());
      dispatch(anonUserSortChanged(sort));
      dispatch(fetchUsersAnonymousDevices());
    }
  };
}

export function changeAnonQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    // dispatch(usersFetchBegin());
    dispatch(anonQueryChanged(query));
    fetchAnonUsersWithDebounce(dispatch);
  };
}

export function changeAnonPage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    // dispatch(usersFetchBegin());
    dispatch(anonPageChanged(page));
    dispatch(fetchUsersAnonymousDevices());
  };
}

// export function fetchUsersAnonymousDevices(): ThunkResult<void> {
//   return async (dispatch, getState) => {
//     try {
//       let url = `/api/anonymous/devices`;
//       const result = await getBackendSrv().get(url);
//       dispatch(usersAnonymousDevicesFetched({ devices: result }));
//     } catch (error) {
//       usersFetchEnd();
//       console.error(error);
//     }
//   };
// }
