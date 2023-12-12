/** Map providers to their settings */
export const fields = {
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

export const fieldMap = {
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
    type: 'text',
    validation: {
      required: true,
      message: 'This field is required',
    },
  },
  teamIds: {
    label: 'Team Ids',
    type: 'select',
    multi: true,
    allowCustomValue: true,
    options: [],
  },
  allowedOrganizations: {
    label: 'Allowed Organizations',
    type: 'select',
    multi: true,
    allowCustomValue: true,
    options: [],
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
