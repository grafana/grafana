import { actionCreatorFactory, noPayloadActionCreatorFactory } from 'app/core/redux';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { ThunkResult } from 'app/types';
import { LdapState, LdapUser, LdapConnectionInfo, LdapError } from 'app/types';

export const testLdapMapping = actionCreatorFactory<LdapState>('TEST_LDAP_MAPPING').create();
export const clearError = noPayloadActionCreatorFactory('CLEAR_LDAP_ERROR').create();

export const ldapConnectionInfoLoadedAction = actionCreatorFactory<LdapConnectionInfo>(
  'ldap/CONNECTION_INFO_LOADED'
).create();
export const userInfoLoadedAction = actionCreatorFactory<LdapUser>('ldap/USER_INFO_LOADED').create();
export const userInfoFailedAction = actionCreatorFactory<LdapError>('ldap/USER_INFO_FAILED').create();
export const clearUserError = noPayloadActionCreatorFactory('ldap/CLEAR_USER_ERROR').create();

export function loadLdapState(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get(`/api/admin/ldap/status`);
    dispatch(ldapConnectionInfoLoadedAction(response));
  };
}

export function loadUserMapping(username: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const response = await getBackendSrv().get(`/api/admin/ldap/${username}`);
      const { name, surname, email, login, isGrafanaAdmin, isDisabled, roles, teams } = response;
      const userInfo = {
        info: { name, surname, email, login },
        permissions: { isGrafanaAdmin, isDisabled },
        roles,
        teams,
      };
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
