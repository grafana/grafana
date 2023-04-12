import { Settings } from 'app/types';

import { BASE_PATH } from './constants';
import { AuthProviderInfo } from './types';

export function filterAuthSettings(settings: Settings) {
  const authSettings: Settings = Object.fromEntries(
    Object.entries(settings).filter(([sectionName]) => sectionName === 'auth')
  );
  return authSettings;
}

export function getProviderUrl(provider: AuthProviderInfo) {
  return BASE_PATH + (provider.configPath || provider.id);
}
