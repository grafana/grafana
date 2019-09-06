import { actionCreatorFactory, noPayloadActionCreatorFactory } from 'app/core/redux';
import { ThunkResult } from 'app/types';
import { LdapUser, LdapConnectionInfo, LdapError } from 'app/types';
import { getUserInfo, getLdapState } from './apis';

export const ldapConnectionInfoLoadedAction = actionCreatorFactory<LdapConnectionInfo>(
  'ldap/CONNECTION_INFO_LOADED'
).create();
export const userInfoLoadedAction = actionCreatorFactory<LdapUser>('ldap/USER_INFO_LOADED').create();
export const userInfoFailedAction = actionCreatorFactory<LdapError>('ldap/USER_INFO_FAILED').create();
export const clearUserError = noPayloadActionCreatorFactory('ldap/CLEAR_USER_ERROR').create();

export function loadLdapState(): ThunkResult<void> {
  return async dispatch => {
    const connectionInfo = await getLdapState();
    dispatch(ldapConnectionInfoLoadedAction(connectionInfo));
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
