import { BASE_PATH } from './constants';
import { AuthProviderInfo } from './types';

export function getProviderUrl(provider: AuthProviderInfo) {
  return BASE_PATH + (provider.configPath || provider.id);
}
