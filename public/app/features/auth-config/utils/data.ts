import { SelectableValue } from '@grafana/data';

import { fieldMap, fields } from '../fields';
import { FieldData, SSOProvider, SSOProviderDTO } from '../types';

import { isSelectableValue } from './guards';

export const emptySettings: SSOProviderDTO = {
  allowAssignGrafanaAdmin: false,
  allowSignUp: false,
  allowedDomains: [],
  allowedGroups: [],
  allowedOrganizations: [],
  apiUrl: '',
  authStyle: '',
  authUrl: '',
  autoLogin: false,
  clientId: '',
  clientSecret: '',
  emailAttributeName: '',
  emailAttributePath: '',
  emptyScopes: false,
  enabled: false,
  extra: {},
  groupsAttributePath: '',
  hostedDomain: '',
  icon: 'shield',
  name: '',
  roleAttributePath: '',
  roleAttributeStrict: false,
  scopes: [],
  signoutRedirectUrl: '',
  skipOrgRoleSync: false,
  teamIds: [],
  teamIdsAttributePath: '',
  teamsUrl: '',
  tlsClientCa: '',
  tlsClientCert: '',
  tlsClientKey: '',
  tlsSkipVerify: false,
  tokenUrl: '',
  type: '',
  usePkce: false,
  useRefreshToken: false,
};

const strToValue = (val: string | string[]): SelectableValue[] => {
  if (!val?.length) {
    return [];
  }
  if (Array.isArray(val)) {
    return val.map((v) => ({ label: v, value: v }));
  }
  return val.split(/[\s,]/).map((s) => ({ label: s, value: s }));
};

export function dataToDTO(data?: SSOProvider): SSOProviderDTO {
  if (!data) {
    return emptySettings;
  }
  const arrayFields = getArrayFields(fieldMap(data.provider));
  const settings = { ...data.settings };
  for (const field of arrayFields) {
    //@ts-expect-error
    settings[field] = strToValue(settings[field]);
  }
  //@ts-expect-error
  return settings;
}

const valuesToString = (values: Array<SelectableValue<string>>) => {
  return values.map(({ value }) => value).join(',');
};

const includeRequiredKeysOnly = (
  obj: SSOProviderDTO,
  requiredKeys: Array<keyof SSOProvider['settings']>
): Partial<SSOProviderDTO> => {
  if (!requiredKeys) {
    return obj;
  }
  let result: Partial<SSOProviderDTO> = {};
  for (const key of requiredKeys) {
    //@ts-expect-error
    result[key] = obj[key];
  }
  return result;
};

// Convert the DTO to the data format used by the API
export function dtoToData(dto: SSOProviderDTO, provider: string) {
  const arrayFields = getArrayFields(fieldMap(provider));
  let current: Partial<SSOProviderDTO> = dto;

  if (fields[provider]) {
    current = includeRequiredKeysOnly(dto, [...fields[provider], 'enabled']);
  }
  const settings = { ...current };

  for (const field of arrayFields) {
    const value = current[field];
    if (value) {
      if (isSelectableValue(value)) {
        //@ts-expect-error
        settings[field] = valuesToString(value);
      } else if (isSelectableValue([value])) {
        //@ts-expect-error
        settings[field] = value.value;
      }
    }
  }
  return settings;
}

export function getArrayFields(obj: Record<string, FieldData>): Array<keyof SSOProviderDTO> {
  return Object.entries(obj)
    .filter(([_, value]) => value.type === 'select')
    .map(([key]) => key as keyof SSOProviderDTO);
}
