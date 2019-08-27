import { actionCreatorFactory, noPayloadActionCreatorFactory } from 'app/core/redux';
import { LdapState } from 'app/types';

export const testLdapMapping = actionCreatorFactory<LdapState>('TEST_LDAP_MAPPING').create();
export const clearError = noPayloadActionCreatorFactory('CLEAR_LDAP_ERROR').create();
