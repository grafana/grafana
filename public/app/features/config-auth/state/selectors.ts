import { AuthConfigState } from 'app/types';

export const selectSamlConfig = (state: AuthConfigState) => {
  return state.settings['auth.saml'] || {};
};
