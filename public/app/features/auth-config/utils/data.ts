import { SelectableValue } from '@grafana/data';

import { fieldMap, sectionFields } from '../fields';
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
  // Stored as JSON Array
  if (val.startsWith('[') && val.endsWith(']')) {
    // Fallback to parsing it like a non-json string if it is not valid json, instead of crashing.
    try {
      return JSON.parse(val).map((v: string) => ({ label: v, value: v }));
    } catch {}
  }

  return val.split(/[\s,]/).map((s) => ({ label: s, value: s }));
};

export function dataToDTO(data?: SSOProvider): SSOProviderDTO {
  if (!data) {
    return emptySettings;
  }
  const providerFields = getFieldsForProvider(data.provider);
  const arrayFields = getArrayFields(fieldMap(data.provider), providerFields);
  const settings = { ...data.settings };
  for (const field of arrayFields) {
    //@ts-expect-error
    settings[field] = strToValue(settings[field]);
  }
  //@ts-expect-error
  return settings;
}

const valuesToString = (values: Array<SelectableValue<string>>) => {
  if (values.length <= 1) {
    return values.map(({ value }) => value).join(',');
  }
  // Store as JSON array if there are multiple values
  return JSON.stringify(values.map(({ value }) => value));
};

const getFieldsForProvider = (provider: string) => {
  const sections = sectionFields[provider];

  // include the enabled field because it is not part of the fields defined for providers
  const fields = ['enabled'];

  return Object.values(sections).reduce(
    (result, section) => [
      ...result,
      ...section.fields.map((field) => (typeof field === 'string' ? field : field.name)),
    ],
    fields
  );
};

// Convert the DTO to the data format used by the API
export function dtoToData(dto: SSOProviderDTO, provider: string) {
  let current: Partial<SSOProviderDTO> = dto;

  const providerFields = getFieldsForProvider(provider);
  const arrayFields = getArrayFields(fieldMap(provider), providerFields);

  // filter out the fields that are not defined on the provider
  const settings: Partial<SSOProviderDTO> = Object.keys(current)
    .filter((key) => providerFields.includes(key))
    .reduce((obj, key) => {
      //@ts-expect-error
      return { ...obj, [key]: current[key] };
    }, {});

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

export function getArrayFields(obj: Record<string, FieldData>, providerFields: string[]): Array<keyof SSOProviderDTO> {
  return Object.entries(obj)
    .filter(([key, value]) => providerFields.includes(key) && value.type === 'select')
    .map(([key]) => key as keyof SSOProviderDTO);
}
