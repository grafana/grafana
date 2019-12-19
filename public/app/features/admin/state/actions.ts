import { actionCreatorFactory } from 'app/core/redux';
import { updateLocation } from 'app/core/actions';
import config from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import {
  ThunkResult,
  SyncInfo,
  LdapUser,
  LdapConnectionInfo,
  LdapError,
  UserSession,
  User,
  UserDTO,
  UserOrg,
  UserAdminError,
} from 'app/types';
import {
  getUserInfo,
  getLdapState,
  syncLdapUser,
  getUser,
  getUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  getLdapSyncStatus,
} from './apis';

// Action types

export const ldapConnectionInfoLoadedAction = actionCreatorFactory<LdapConnectionInfo>(
  'ldap/CONNECTION_INFO_LOADED'
).create();
export const ldapSyncStatusLoadedAction = actionCreatorFactory<SyncInfo>('ldap/SYNC_STATUS_LOADED').create();
export const userMappingInfoLoadedAction = actionCreatorFactory<LdapUser>('ldap/USER_INFO_LOADED').create();
export const userMappingInfoFailedAction = actionCreatorFactory<LdapError>('ldap/USER_INFO_FAILED').create();
export const clearUserMappingInfoAction = actionCreatorFactory('ldap/CLEAR_USER_MAPPING_INFO').create();
export const clearUserErrorAction = actionCreatorFactory('ldap/CLEAR_USER_ERROR').create();
export const ldapFailedAction = actionCreatorFactory<LdapError>('ldap/LDAP_FAILED').create();

export const userLoadedAction = actionCreatorFactory<User>('USER_LOADED').create();
export const userSyncFailedAction = actionCreatorFactory('USER_SYNC_FAILED').create();

// UserAdminPage
export const userAdminPageLoadedAction = actionCreatorFactory<boolean>('admin/user/PAGE_LOADED').create();
export const userProfileLoadedAction = actionCreatorFactory<UserDTO>('admin/user/PROFILE_LOADED').create();
export const userOrgsLoadedAction = actionCreatorFactory<UserOrg[]>('admin/user/ORGS_LOADED').create();
export const userSessionsLoadedAction = actionCreatorFactory<UserSession[]>('admin/user/SESSIONS_LOADED').create();
export const revokeUserSessionAction = actionCreatorFactory('admin/user/REVOKE_SESSION').create();
export const revokeAllUserSessionsAction = actionCreatorFactory('admin/user/REVOKE_ALL_SESSIONS').create();
export const userAdminPageFailedAction = actionCreatorFactory<UserAdminError>('admin/user/PAGE_FAILED').create();

// Actions

export function loadLdapState(): ThunkResult<void> {
  return async dispatch => {
    try {
      const connectionInfo = await getLdapState();
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

export function loadLdapSyncStatus(): ThunkResult<void> {
  return async dispatch => {
    if (config.buildInfo.isEnterprise) {
      // Available only in enterprise
      const syncStatus = await getLdapSyncStatus();
      dispatch(ldapSyncStatusLoadedAction(syncStatus));
    }
  };
}

export function loadUserMapping(username: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const userInfo = await getUserInfo(username);
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

export function syncUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    try {
      await syncLdapUser(userId);
      dispatch(loadLdapUserInfo(userId));
      dispatch(loadLdapSyncStatus());
    } catch (error) {
      dispatch(userSyncFailedAction());
    }
  };
}

export function loadLdapUserInfo(userId: number): ThunkResult<void> {
  return async dispatch => {
    try {
      const user = await getUser(userId);
      dispatch(userLoadedAction(user));
      dispatch(loadUserSessions(userId));
      dispatch(loadUserMapping(user.login));
    } catch (error) {
      error.isHandled = true;
      const userError = {
        title: error.data.message,
        body: error.data.error,
      };
      dispatch(userMappingInfoFailedAction(userError));
    }
  };
}

// UserAdminPage

export function loadAdminUserPage(userId: number): ThunkResult<void> {
  return async dispatch => {
    try {
      dispatch(userAdminPageLoadedAction(false));
      await dispatch(loadUserProfile(userId));
      await dispatch(loadUserOrgs(userId));
      await dispatch(loadUserSessions(userId));
      if (config.ldapEnabled && config.buildInfo.isEnterprise) {
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
    console.log('update user', user);
    await getBackendSrv().put(`/api/users/${user.id}`, user);
    dispatch(loadAdminUserPage(user.id));
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
    console.log('delete user', userId);
    // await getBackendSrv().delete(`/api/admin/users/${userId}`);
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
    console.log(`add user ${user.login} to org ${orgId} as ${role}`);
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
    console.log(`update user ${userId} role in org ${orgId} to ${role}`);
    const payload = { role };
    await getBackendSrv().patch(`/api/orgs/${orgId}/users/${userId}`, payload);
    dispatch(loadAdminUserPage(userId));
  };
}

export function deleteOrgUser(userId: number, orgId: number): ThunkResult<void> {
  return async dispatch => {
    console.log(`delete user ${userId} from org ${orgId}`);
    await getBackendSrv().delete(`/api/orgs/${orgId}/users/${userId}`);
    dispatch(loadAdminUserPage(userId));
  };
}

export function loadUserSessions(userId: number): ThunkResult<void> {
  return async dispatch => {
    const sessions = await getUserSessions(userId);
    dispatch(userSessionsLoadedAction(sessions));
  };
}

export function revokeSession(tokenId: number, userId: number): ThunkResult<void> {
  return async dispatch => {
    await revokeUserSession(tokenId, userId);
    dispatch(loadUserSessions(userId));
  };
}

export function revokeAllSessions(userId: number): ThunkResult<void> {
  return async dispatch => {
    await revokeAllUserSessions(userId);
    dispatch(loadUserSessions(userId));
  };
}
