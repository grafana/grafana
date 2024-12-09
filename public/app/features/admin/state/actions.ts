import { debounce } from 'lodash';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { featureEnabled, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { FetchDataArgs } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import {
  ThunkResult,
  LdapUser,
  UserSession,
  UserDTO,
  AccessControlAction,
  UserFilter,
  AnonUserFilter,
} from 'app/types';

import {
  userAdminPageLoadedAction,
  userProfileLoadedAction,
  userOrgsLoadedAction,
  userSessionsLoadedAction,
  userAdminPageFailedAction,
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
// UserAdminPage

export function loadAdminUserPage(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(userAdminPageLoadedAction(false));
      await dispatch(loadUserProfile(userUid));
      await dispatch(loadUserOrgs(userUid));
      await dispatch(loadUserSessions(userUid));
      if (config.ldapEnabled && featureEnabled('ldapsync')) {
        await dispatch(loadLdapSyncStatus());
      }
      dispatch(userAdminPageLoadedAction(true));
    } catch (error) {
      console.error(error);

      if (isFetchError(error)) {
        const userError = {
          title: error.data.message,
          body: error.data.error,
        };

        dispatch(userAdminPageFailedAction(userError));
      }
    }
  };
}

export function loadUserProfile(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    const user = await getBackendSrv().get(`/api/users/${userUid}`, accessControlQueryParam());
    dispatch(userProfileLoadedAction(user));
  };
}

export function updateUser(user: UserDTO): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().put(`/api/users/${user.uid}`, user);
    dispatch(loadAdminUserPage(user.uid));
  };
}

export function setUserPassword(userUid: string, password: string): ThunkResult<void> {
  return async (dispatch) => {
    const payload = { password };
    await getBackendSrv().put(`/api/admin/users/${userUid}/password`, payload);
    dispatch(loadAdminUserPage(userUid));
  };
}

export function disableUser(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post(`/api/admin/users/${userUid}/disable`);
    locationService.push('/admin/users');
  };
}

export function enableUser(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post(`/api/admin/users/${userUid}/enable`);
    dispatch(loadAdminUserPage(userUid));
  };
}

export function deleteUser(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/admin/users/${userUid}`);
    locationService.push('/admin/users');
  };
}

export function updateUserPermissions(userUid: string, isGrafanaAdmin: boolean): ThunkResult<void> {
  return async (dispatch) => {
    const payload = { isGrafanaAdmin };
    await getBackendSrv().put(`/api/admin/users/${userUid}/permissions`, payload);
    dispatch(loadAdminUserPage(userUid));
  };
}

export function loadUserOrgs(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    const orgs = await getBackendSrv().get(`/api/users/${userUid}/orgs`);
    dispatch(userOrgsLoadedAction(orgs));
  };
}

export function addOrgUser(user: UserDTO, orgId: number, role: string): ThunkResult<void> {
  return async (dispatch) => {
    const payload = {
      loginOrEmail: user.login,
      role: role,
    };
    await getBackendSrv().post(`/api/orgs/${orgId}/users/`, payload);
    dispatch(loadAdminUserPage(user.uid));
  };
}

export function updateOrgUserRole(userUid: string, orgId: number, role: string): ThunkResult<void> {
  return async (dispatch) => {
    const payload = { role };
    await getBackendSrv().patch(`/api/orgs/${orgId}/users/${userUid}`, payload);
    dispatch(loadAdminUserPage(userUid));
  };
}

export function deleteOrgUser(userUid: string, orgId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/orgs/${orgId}/users/${userUid}`);
    dispatch(loadAdminUserPage(userUid));
  };
}

export function loadUserSessions(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    if (!contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList)) {
      return;
    }

    const tokens = await getBackendSrv().get(`/api/admin/users/${userUid}/auth-tokens`);
    tokens.reverse();

    const sessions = tokens.map((session: UserSession) => {
      return {
        id: session.id,
        isActive: session.isActive,
        seenAt: dateTimeFormatTimeAgo(session.seenAt),
        createdAt: session.createdAt,
        clientIp: session.clientIp,
        browser: session.browser,
        browserVersion: session.browserVersion,
        authModule: session.authModule,
        os: session.os,
        osVersion: session.osVersion,
        device: session.device,
      };
    });

    dispatch(userSessionsLoadedAction(sessions));
  };
}

export function revokeSession(tokenId: number, userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    const payload = { authTokenId: tokenId };
    await getBackendSrv().post(`/api/admin/users/${userUid}/revoke-auth-token`, payload);
    dispatch(loadUserSessions(userUid));
  };
}

export function revokeAllSessions(userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post(`/api/admin/users/${userUid}/logout`);
    dispatch(loadUserSessions(userUid));
  };
}

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

export function syncLdapUser(userId: number, userUid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post(`/api/admin/ldap/sync/${userId}`);
    dispatch(loadAdminUserPage(userUid));
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
