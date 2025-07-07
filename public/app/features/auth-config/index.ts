import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { Settings, SettingsSection } from 'app/types/settings';

import { AuthProviderInfo, GetStatusHook, AuthProviderStatus } from './types';

export * from './types';

const registeredAuthProviders: AuthProviderInfo[] = [];
const authProvidersConfigHooks: Record<string, GetStatusHook> = {};

export function registerAuthProvider(provider: AuthProviderInfo, getConfigHook?: GetStatusHook) {
  if (!registeredAuthProviders.find((p) => p.id === provider.id)) {
    registeredAuthProviders.push(provider);
    if (getConfigHook) {
      authProvidersConfigHooks[provider.id] = getConfigHook;
    }
  }
}

export function getRegisteredAuthProviders(): AuthProviderInfo[] {
  return registeredAuthProviders;
}

export function getAuthProviderInfo(provider: string) {
  return registeredAuthProviders.find((p) => p.id === provider);
}

export function getAuthProviders(cfg: Settings): SettingsSection[] {
  const providers: SettingsSection[] = [];
  for (const [section, sectionConfig] of Object.entries(cfg)) {
    const provider = registeredAuthProviders.find((provider: AuthProviderInfo) => `auth.${provider.id}` === section);
    if (provider) {
      const providerData = {
        ...sectionConfig,
        providerId: provider.id,
        displayName: sectionConfig.name || provider.displayName,
      };
      providers.push(providerData);
    }
  }
  return providers;
}

export async function getAuthProviderStatus(providerId: string): Promise<AuthProviderStatus> {
  if (authProvidersConfigHooks[providerId]) {
    const getStatusHook = authProvidersConfigHooks[providerId];
    return getStatusHook();
  }
  return { configured: false, enabled: false };
}

export function initAuthConfig() {
  // skip the LDAP provider if it is enabled by SSO settings
  if (config.featureToggles.ssoSettingsLDAP) {
    return;
  }

  const ldapAuthProvider: AuthProviderInfo = {
    id: 'ldap',
    type: 'LDAP',
    protocol: 'LDAP',
    displayName: 'LDAP',
    configPath: 'ldap',
  };
  registerAuthProvider(ldapAuthProvider, getConfigHookLDAP);
}

async function getConfigHookLDAP(): Promise<AuthProviderStatus> {
  if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
    const result = await getBackendSrv().get('/api/admin/settings');
    const ldapSettings = result!['auth.ldap'] || {};
    return {
      configured: ldapSettings['enabled'] === 'true',
      enabled: ldapSettings['enabled'] === 'true',
      hide: ldapSettings['enabled'] !== 'true',
    };
  }

  return { configured: false, enabled: false };
}
