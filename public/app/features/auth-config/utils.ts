import { SelectableValue } from '@grafana/data';

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

const valuesToArray = (values: Array<SelectableValue<string>>) => {
  return values.map(({ value }) => value).join(',');
};

// Convert the DTO to the data format used by the API
export function dtoToData<T extends Partial<SSOProviderDTO>>(dto: T, data?: SSOProvider) {
  const settings = {
    ...dto,
    ...(dto.teamIds ? { teamIds: valuesToArray(dto.teamIds) } : {}),
    ...(dto.allowedOrganizations ? { allowedOrganizations: valuesToArray(dto.allowedOrganizations) } : {}),
  };
  if (!data) {
    return {
      settings,
    };
  }
  return {
    ...data,
    settings: {
      ...data.settings,
      ...dto,
      ...settings,
    },
  };
}
