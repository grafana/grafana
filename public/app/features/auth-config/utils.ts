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

export const dtoToData = (dto: SSOProviderDTO, data?: SSOProvider) => {
  if (!data) {
    return {
      settings: {
        ...dto,
        teamIds: valuesToArray(dto.teamIds),
        allowedOrganizations: valuesToArray(dto.allowedOrganizations),
      },
    };
  }
  return {
    ...data,
    settings: {
      ...data.settings,
      ...dto,
      teamIds: valuesToArray(dto.teamIds),
      allowedOrganizations: valuesToArray(dto.allowedOrganizations),
    },
  };
};
