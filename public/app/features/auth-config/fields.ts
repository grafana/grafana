import { FieldData, SSOProvider } from './types';
import { isSelectableValue } from './utils/guards';

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

/**
 * List all the fields that can be used in the form
 */
export const fieldMap: Record<string, FieldData> = {
  clientId: {
    label: 'Client Id',
    type: 'text',
    validation: {
      required: true,
      message: 'This field is required',
    },
  },
  clientSecret: {
    label: 'Client Secret',
    type: 'secret',
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
        if (isSelectableValue(value)) {
          return value.every((v) => v?.value && isNumeric(v.value));
        }
        return true;
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
};

// Check if a string contains only numeric values
function isNumeric(value: string) {
  return /^-?\d+$/.test(value);
}
