import { actionCreatorFactory } from 'app/core/redux';
import { LdapState } from 'app/types';

export const testLdapMapping = actionCreatorFactory<LdapState>('TEST_LDAP_MAPPING').create();
