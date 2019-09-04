import { actionCreatorFactory, noPayloadActionCreatorFactory } from 'app/core/redux';
import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { StoreState, LdapState } from 'app/types';

export const testLdapMapping = actionCreatorFactory<LdapState>('TEST_LDAP_MAPPING').create();
export const clearError = noPayloadActionCreatorFactory('CLEAR_LDAP_ERROR').create();

export enum ActionTypes {
  LoadLdapState = 'LOAD_LDAP_STATE',
}

export interface LoadLdapStateAction {
  type: ActionTypes.LoadLdapState;
  payload: LdapState;
}

const ldapStateLoaded = (ldapState: LdapState): LoadLdapStateAction => ({
  type: ActionTypes.LoadLdapState,
  payload: ldapState,
});

export type Action = LoadLdapStateAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadLdapState(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get(`/api/ldap/status`);
    dispatch(ldapStateLoaded(response));
  };
}
