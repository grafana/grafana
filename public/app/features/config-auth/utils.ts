import { Settings } from 'app/types';

import { AuthProviderInfo } from './types';

const AvailableAuthProviders = [
  'azuread',
  'generic_oauth',
  'github',
  'gitlab',
  'google',
  'grafana_com',
  'jwt',
  'okta',
  'saml',
];

const providers: { [key: string]: AuthProviderInfo } = {
  azuread: { id: 'azuread', displayName: 'azuread' },
  generic_oauth: { id: 'generic_oauth', displayName: 'OAuht2' },
  github: { id: 'github', displayName: 'github' },
  gitlab: { id: 'gitlab', displayName: 'gitlab' },
  google: { id: 'google', displayName: 'google' },
  grafana_com: { id: 'grafana_com', displayName: 'grafana_com' },
  jwt: { id: 'jwt', displayName: 'jwt' },
  okta: { id: 'okta', displayName: 'Okta OAuht2' },
  saml: { id: 'saml', displayName: 'SAML' },
};

export function getAuthProviderInfo(provider: string) {
  return providers[provider];
}

export function getEnabledAuthProviders(cfg: Settings): string[] {
  const enabled: string[] = [];
  for (const section in cfg) {
    if (Object.prototype.hasOwnProperty.call(cfg, section)) {
      const sectionConfig = cfg[section];
      const provider = AvailableAuthProviders.find((provider) => `auth.${provider}` === section);
      if (provider) {
        if (sectionConfig['enabled'] === 'true') {
          enabled.push(provider);
        }
      }
    }
  }
  return enabled;
}
