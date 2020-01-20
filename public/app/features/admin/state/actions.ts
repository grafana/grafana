import { updateLocation } from 'app/core/actions';
import config from 'app/core/config';
import { dateTime } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { ThunkResult, LdapUser, UserSession, UserDTO } from 'app/types';

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
} from './reducers';

// UserAdminPage

export function loadAdminUserPage(userId: number): ThunkResult<void> {
  return async dispatch => {
    try {
      dispatch(userAdminPageLoadedAction(false));
      await dispatch(loadUserProfile(userId));
      await dispatch(loadUserOrgs(userId));
      await dispatch(loadUserSessions(userId));
      if (config.ldapEnabled && config.licenseInfo.hasLicense) {
        await dispatch(loadLdapSyncStatus());
      }
      dispatch(userAdminPageLoadedAction(true));
    } catch (error) {
      console.log(error);
      error.isHandled = true;
      const userError = {
        title: error.data.message,
        body: error.data.error,
      };
      dispatch(userAdminPageFailedAction(userError));
    }
  };
}

export function loadUserProfile(userId: number): ThunkResult<void> {
  return async dispatch => {
    const user = await getBackendSrv().get(`/api/users/${userId}`);
    dispatch(userProfileLoadedAction(user));
  };
}

export function updateUser(user: UserDTO): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().put(`/api/users/${user.id}`, user);
    dispatch(loadAdminUserPage(user.id));
  };
}

export function setUserPassword(userId: number, password: string): ThunkResult<void> {
  return async dispatch => {
    const payload = { password };
    await getBackendSrv().put(`/api/admin/users/${userId}/password`, payload);
    dispatch(loadAdminUserPage(userId));
  };
}

export function disableUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post(`/api/admin/users/${userId}/disable`);
    // dispatch(loadAdminUserPage(userId));
    dispatch(updateLocation({ path: '/admin/users' }));
  };
}

export function enableUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post(`/api/admin/users/${userId}/enable`);
    dispatch(loadAdminUserPage(userId));
  };
}

export function deleteUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().delete(`/api/admin/users/${userId}`);
    dispatch(updateLocation({ path: '/admin/users' }));
  };
}

export function updateUserPermissions(userId: number, isGrafanaAdmin: boolean): ThunkResult<void> {
  return async dispatch => {
    const payload = { isGrafanaAdmin };
    await getBackendSrv().put(`/api/admin/users/${userId}/permissions`, payload);
    dispatch(loadAdminUserPage(userId));
  };
}

export function loadUserOrgs(userId: number): ThunkResult<void> {
  return async dispatch => {
    const orgs = await getBackendSrv().get(`/api/users/${userId}/orgs`);
    dispatch(userOrgsLoadedAction(orgs));
  };
}

export function addOrgUser(user: UserDTO, orgId: number, role: string): ThunkResult<void> {
  return async dispatch => {
    const payload = {
      loginOrEmail: user.login,
      role: role,
    };
    await getBackendSrv().post(`/api/orgs/${orgId}/users/`, payload);
    dispatch(loadAdminUserPage(user.id));
  };
}

export function updateOrgUserRole(userId: number, orgId: number, role: string): ThunkResult<void> {
  return async dispatch => {
    const payload = { role };
    await getBackendSrv().patch(`/api/orgs/${orgId}/users/${userId}`, payload);
    dispatch(loadAdminUserPage(userId));
  };
}

export function deleteOrgUser(userId: number, orgId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().delete(`/api/orgs/${orgId}/users/${userId}`);
    dispatch(loadAdminUserPage(userId));
  };
}

export function loadUserSessions(userId: number): ThunkResult<void> {
  return async dispatch => {
    const tokens = await getBackendSrv().get(`/api/admin/users/${userId}/auth-tokens`);
    tokens.reverse();
    const sessions = tokens.map((session: UserSession) => {
      return {
        id: session.id,
        isActive: session.isActive,
        seenAt: dateTime(session.seenAt).fromNow(),
        createdAt: dateTime(session.createdAt).format('MMMM DD, YYYY'),
        clientIp: session.clientIp,
        browser: session.browser,
        browserVersion: session.browserVersion,
        os: session.os,
        osVersion: session.osVersion,
        device: session.device,
      };
    });
    dispatch(userSessionsLoadedAction(sessions));
  };
}

export function revokeSession(tokenId: number, userId: number): ThunkResult<void> {
  return async dispatch => {
    const payload = { authTokenId: tokenId };
    await getBackendSrv().post(`/api/admin/users/${userId}/revoke-auth-token`, payload);
    dispatch(loadUserSessions(userId));
  };
}

export function revokeAllSessions(userId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post(`/api/admin/users/${userId}/logout`);
    dispatch(loadUserSessions(userId));
  };
}

// LDAP user actions

export function loadLdapSyncStatus(): ThunkResult<void> {
  return async dispatch => {
    // Available only in enterprise
    if (config.licenseInfo.hasLicense) {
      const syncStatus = await getBackendSrv().get(`/api/admin/ldap-sync-status`);
      dispatch(ldapSyncStatusLoadedAction(syncStatus));
    }
  };
}

export function syncLdapUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().post(`/api/admin/ldap/sync/${userId}`);
    dispatch(loadAdminUserPage(userId));
  };
}

// LDAP debug page

export function loadLdapState(): ThunkResult<void> {
  return async dispatch => {
    try {
      const connectionInfo = await getBackendSrv().get(`/api/admin/ldap/status`);
      dispatch(ldapConnectionInfoLoadedAction(connectionInfo));
    } catch (error) {
      error.isHandled = true;
      const ldapError = {
        title: error.data.message,
        body: error.data.error,
      };
      dispatch(ldapFailedAction(ldapError));
    }
  };
}

export function loadUserMapping(username: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const response = await getBackendSrv().get(`/api/admin/ldap/${username}`);
      const { name, surname, email, login, isGrafanaAdmin, isDisabled, roles, teams } = response;
      const userInfo: LdapUser = {
        info: { name, surname, email, login },
        permissions: { isGrafanaAdmin, isDisabled },
        roles,
        teams,
      };
      dispatch(userMappingInfoLoadedAction(userInfo));
    } catch (error) {
      error.isHandled = true;
      const userError = {
        title: error.data.message,
        body: error.data.error,
      };
      dispatch(clearUserMappingInfoAction());
      dispatch(userMappingInfoFailedAction(userError));
    }
  };
}

export function clearUserError(): ThunkResult<void> {
  return dispatch => {
    dispatch(clearUserErrorAction());
  };
}

export function clearUserMappingInfo(): ThunkResult<void> {
  return dispatch => {
    dispatch(clearUserErrorAction());
    dispatch(clearUserMappingInfoAction());
  };
}
