import { SelectableValue } from '@grafana/data';

import { BASE_PATH } from './constants';
import { AuthProviderInfo, SSOProvider, SSOProviderDTO } from './types';

export function getProviderUrl(provider: AuthProviderInfo) {
  return BASE_PATH + (provider.configPath || `advanced/${provider.id}`);
}

const strToValue = (val: string | string[]) => {
  if (!val?.length) {
    return [];
  }
  if (Array.isArray(val)) {
    return val.map((v) => ({ label: v, value: v }));
  }
  return val.split(',').map((s) => ({ label: s, value: s }));
};

export function dataToDTO(data?: SSOProvider): SSOProviderDTO {
  if (!data) {
    return {
      clientId: '',
      clientSecret: '',
      enabled: false,
      teamIds: [],
      allowedOrganizations: [],
    };
  }
  return {
    ...data.settings,
    teamIds: strToValue(data.settings.teamIds),
    allowedOrganizations: strToValue(data.settings.allowedOrganizations),
  };
}

const valuesToString = (values: Array<SelectableValue<string>>) => {
  return values.map(({ value }) => value).join(',');
};

// Convert the DTO to the data format used by the API
export function dtoToData<T extends Partial<SSOProviderDTO>>(dto: T) {
  const settings = {
    ...dto,
    ...(dto.teamIds ? { teamIds: valuesToString(dto.teamIds) } : {}),
    ...(dto.allowedOrganizations ? { allowedOrganizations: valuesToString(dto.allowedOrganizations) } : {}),
  };
  return {
    settings,
  };
}
