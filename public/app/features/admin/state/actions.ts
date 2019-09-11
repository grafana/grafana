import { actionCreatorFactory, noPayloadActionCreatorFactory } from 'app/core/redux';
import { ThunkResult, SyncInfo, LdapUser, LdapConnectionInfo, LdapError, UserSession, User } from 'app/types';
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

export const ldapConnectionInfoLoadedAction = actionCreatorFactory<LdapConnectionInfo>(
  'ldap/CONNECTION_INFO_LOADED'
).create();
export const ldapSyncStatusLoadedAction = actionCreatorFactory<SyncInfo>('ldap/SYNC_STATUS_LOADED').create();
export const userInfoLoadedAction = actionCreatorFactory<LdapUser>('ldap/USER_INFO_LOADED').create();
export const userInfoFailedAction = actionCreatorFactory<LdapError>('ldap/USER_INFO_FAILED').create();
export const clearUserError = noPayloadActionCreatorFactory('ldap/CLEAR_USER_ERROR').create();
export const userLoadedAction = actionCreatorFactory<User>('USER_LOADED').create();
export const userSessionsLoadedAction = actionCreatorFactory<UserSession[]>('USER_SESSIONS_LOADED').create();
export const userSyncedAction = noPayloadActionCreatorFactory('USER_SYNCED').create();
export const userSyncFailedAction = noPayloadActionCreatorFactory('USER_SYNC_FAILED').create();
export const revokeUserSessionAction = noPayloadActionCreatorFactory('REVOKE_USER_SESSION').create();
export const revokeAllUserSessionsAction = noPayloadActionCreatorFactory('REVOKE_ALL_USER_SESSIONS').create();

export function loadLdapState(): ThunkResult<void> {
  return async dispatch => {
    const connectionInfo = await getLdapState();
    dispatch(ldapConnectionInfoLoadedAction(connectionInfo));
  };
}

export function loadLdapSyncStatus(): ThunkResult<void> {
  return async dispatch => {
    const syncStatus = await getLdapSyncStatus();
    dispatch(ldapSyncStatusLoadedAction(syncStatus));
  };
}

export function loadUserMapping(username: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const userInfo = await getUserInfo(username);
      dispatch(userInfoLoadedAction(userInfo));
    } catch (error) {
      const userError = {
        title: error.data.message,
        body: error.data.error,
      };
      dispatch(userInfoFailedAction(userError));
    }
  };
}

export function syncUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    try {
      // await syncLdapUser(userId);
      dispatch(loadUser(userId));
      dispatch(loadLdapSyncStatus());
    } catch (error) {
      dispatch(userSyncFailedAction());
    }
  };
}

export function loadUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    try {
      const user = await getUser(userId);
      dispatch(userLoadedAction(user));
    } catch (error) {
      const userError = {
        title: error.data.message,
        body: error.data.error,
      };
      dispatch(userInfoFailedAction(userError));
    }
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
