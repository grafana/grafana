import { BASE_PATH } from './constants';
import { AuthProviderInfo, SSOProvider, SSOProviderDTO } from './types';

export function getProviderUrl(provider: AuthProviderInfo) {
  return BASE_PATH + (provider.configPath || provider.id);
}

const strToValue = (str: string) => {
  if (!str) {
    return [];
  }
  return str.split(',').map((s) => ({ label: s, value: s }));
};

export const dataToDTO = (data?: SSOProvider): SSOProviderDTO => {
  if (!data) {
    return {
      clientId: '',
      clientSecret: '',
      enabled: false,
      teamIds: [],
      allowedOrganizations: [],
      name: '',
      type: '',
    };
  }
  return {
    ...data.settings,
    teamIds: strToValue(data.settings.teamIds),
    allowedOrganizations: strToValue(data.settings.allowedOrganizations),
  };
};
