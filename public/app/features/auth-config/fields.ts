import { FieldData, SSOProvider } from './types';

/** Map providers to their settings */
export const fields: Record<SSOProvider['provider'], Array<keyof SSOProvider['settings']>> = {
  github: ['clientId', 'clientSecret', 'teamIds', 'allowedOrganizations'],
  google: ['clientId', 'clientSecret', 'allowedDomains'],
  gitlab: ['clientId', 'clientSecret', 'allowedOrganizations', 'teamIds'],
  azuread: ['clientId', 'clientSecret', 'authUrl', 'tokenUrl', 'scopes', 'allowedGroups', 'allowedDomains'],
  okta: [
    'clientId',
    'clientSecret',
    'authUrl',
    'tokenUrl',
    'apiUrl',
    'roleAttributePath',
    'allowedGroups',
    'allowedDomains',
  ],
};

type Section = Record<
  SSOProvider['provider'],
  Array<{
    name: string;
    id: string;
    fields: Array<keyof SSOProvider['settings']>;
  }>
>;

export const sectionFields: Section = {
  generic_oauth: [
    {
      name: 'General settings',
      id: 'general',
      fields: [
        'name',
        'clientId',
        'clientSecret',
        'scopes',
        'authUrl',
        'tokenUrl',
        'apiUrl',
        'allowSignUp',
        'autoLogin',
        'signoutRedirectUrl',
      ],
    },
    { name: 'User mapping', id: 'user', fields: ['emailAttributeName', 'emailAttributePath', 'roleAttributePath'] },
  ],
};

/**
 * List all the fields that can be used in the form
 */
export const fieldMap: Record<string, FieldData> = {
  clientId: {
    label: 'Client Id',
    type: 'text',
    description: 'These values must match the client ID from your OAuth2 app.',
    validation: {
      required: true,
      message: 'This field is required',
    },
  },
  clientSecret: {
    label: 'Client Secret',
    type: 'secret',
    description: 'These values must match the client secret from your OAuth2 app.',
  },
  teamIds: {
    label: 'Team Ids',
    type: 'select',
    multi: true,
    allowCustomValue: true,
    options: [],
    placeholder: 'Enter team IDs and press Enter to add',
    validation: {
      validate: (value) => {
        if (typeof value === 'string') {
          return isNumeric(value);
        }
        return value.every((v) => v?.value && isNumeric(v.value));
      },
      message: 'Team ID must be a number.',
    },
  },
  allowedOrganizations: {
    label: 'Allowed Organizations',
    type: 'select',
    multi: true,
    allowCustomValue: true,
    options: [],
    placeholder: 'Enter organizations (my-team, myteam...) and press Enter to add',
  },
  allowedDomains: {
    label: 'Allowed Domains',
    type: 'select',
    multi: true,
    allowCustomValue: true,
    options: [],
  },
  authUrl: {
    label: 'Auth Url',
    type: 'text',
    validation: {
      required: false,
    },
  },
  tokenUrl: {
    label: 'Token Url',
    type: 'text',
    validation: {
      required: false,
    },
  },
  scopes: {
    label: 'Scopes',
    type: 'select',
    multi: true,
    allowCustomValue: true,
    options: [],
  },
  allowedGroups: {
    label: 'Allowed Groups',
    type: 'select',
    multi: true,
    allowCustomValue: true,
    options: [],
  },
  apiUrl: {
    label: 'API Url',
    type: 'text',
    validation: {
      required: false,
    },
  },
  roleAttributePath: {
    label: 'Role Attribute Path',
    type: 'text',
    validation: {
      required: false,
    },
  },
  name: {
    label: 'Display name',
    description: 'Helpful if you use more than one identity providers or SSO protocols',
    type: 'text',
  },
};

// Check if a string contains only numeric values
function isNumeric(value: string) {
  return /^-?\d+$/.test(value);
}
