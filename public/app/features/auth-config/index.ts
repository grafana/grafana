import { AuthProviderStatus, Settings, SettingsSection } from 'app/types';

import { AuthProviderInfo, GetStatusHook } from './types';

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
    const provider = registeredAuthProviders.find((provider) => `auth.${provider.id}` === section);
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
