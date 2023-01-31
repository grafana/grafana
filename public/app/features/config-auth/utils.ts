import { Settings, SettingsSection } from 'app/types';

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
  azuread: { id: 'azuread', displayName: 'Azure AD OAuth2' },
  generic_oauth: { id: 'generic_oauth', displayName: 'OAuht2' },
  github: { id: 'github', displayName: 'GitHub OAuth2' },
  gitlab: { id: 'gitlab', displayName: 'GitLab OAuth2' },
  google: { id: 'google', displayName: 'Google OAuth2' },
  grafana_com: { id: 'grafana_com', displayName: 'grafana.com OAuth2' },
  jwt: { id: 'jwt', displayName: 'JWT' },
  okta: { id: 'okta', displayName: 'Okta OAuht2' },
  saml: { id: 'saml', displayName: 'SAML' },
};

export function getAuthProviderInfo(provider: string) {
  return providers[provider];
}

export function getAuthProviders(cfg: Settings): SettingsSection[] {
  const providers: SettingsSection[] = [];
  for (const section in cfg) {
    if (Object.prototype.hasOwnProperty.call(cfg, section)) {
      const sectionConfig = cfg[section];
      const provider = AvailableAuthProviders.find((provider) => `auth.${provider}` === section);
      if (provider) {
        const providerData = { ...sectionConfig, providerId: provider };
        providers.push(providerData);
      }
    }
  }
  return providers;
}
