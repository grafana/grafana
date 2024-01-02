import { FieldData, SSOProvider, SSOSettingsField } from './types';

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
    fields: SSOSettingsField[];
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
    {
      name: 'User mapping',
      id: 'user',
      fields: [
        'nameAttributePath',
        'loginAttributePath',
        'emailAttributeName',
        'emailAttributePath',
        'idTokenAttributeName',
        'roleAttributePath',
        'roleAttributeStrict',
        'allowAssignGrafanaAdmin',
        'skipOrgRoleSync',
      ],
    },
    {
      name: 'Extra security measures',
      id: 'extra',
      fields: [
        'allowedOrganizations',
        'allowedDomains',
        'defineAllowedGroups',
        { name: 'allowedGroups', dependsOn: 'defineAllowedGroups' },
        { name: 'groupsAttributePath', dependsOn: 'defineAllowedGroups' },
        'defineAllowedTeamsIds',
        { name: 'teamIds', dependsOn: 'defineAllowedTeamsIds' },
        { name: 'teamsUrl', dependsOn: 'defineAllowedTeamsIds' },
        { name: 'teamIdsAttributePath', dependsOn: 'defineAllowedTeamsIds' },
        'usePkce',
        'useRefreshToken',
      ],
    },
    {
      name: 'TLS',
      id: 'tls',
      fields: ['configureTLS', 'tlsSkipVerifyInsecure', 'tlsClientCert', 'tlsClientKey', 'tlsClientCa'],
    },
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
    description: 'JMESPath expression to use for Grafana role lookup.',
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
  allowSignUp: {
    label: 'Allow sign up',
    description: 'If not enabled, only existing Grafana users can log in using OAuth',
    type: 'switch',
  },
  autoLogin: {
    label: 'Auto login',
    description: 'Log in automatically, skipping the login screen',
    type: 'switch',
  },
  signoutRedirectUrl: {
    label: 'Sign out redirect URL',
    type: 'text',
    validation: {
      required: false,
    },
  },
  emailAttributeName: {
    label: 'Email attribute name',
    description: 'Name of the key to use for user email lookup within the attributes map of OAuth2 ID token.',
    type: 'text',
  },
  emailAttributePath: {
    label: 'Email attribute path',
    description: 'JMESPath expression to use for user email lookup from the user information.',
    type: 'text',
  },
  nameAttributePath: {
    label: 'Name attribute path',
    description:
      'JMESPath expression to use for user name lookup from the user ID token. \n' +
      'This name will be used as the user’s display name.',
    type: 'text',
  },
  loginAttributePath: {
    label: 'Login attribute path',
    description: 'JMESPath expression to use for user login lookup from the user ID token.',
    type: 'text',
  },
  idTokenAttributeName: {
    label: 'ID token attribute name',
    description: 'The name of the key used to extract the ID token from the returned OAuth2 token.',
    type: 'text',
  },
  roleAttributeStrict: {
    label: 'Role attribute strict mode',
    description: 'If enabled, denies user login if the Grafana role cannot be extracted using Role attribute path',
    type: 'switch',
  },
  allowAssignGrafanaAdmin: {
    label: 'Allow assign Grafana admin',
    description: 'If enabled, it will automatically sync the Grafana server administrator role',
    type: 'switch',
  },
  skipOrgRoleSync: {
    label: 'Skip organization role sync',
    description: 'Prevent synchronizing users’ organization roles from your IdP',
    type: 'switch',
  },
  defineAllowedGroups: {
    label: 'Define Allowed Groups',
    type: 'switch',
  },
  defineAllowedTeamsIds: {
    label: 'Define Allowed Teams Ids',
    type: 'switch',
  },
  usePkce: {
    label: 'Use Pkce',
    description: 'If enabled, it will automatically sync the Grafana server administrator role',
    type: 'switch',
  },
  useRefreshToken: {
    label: 'Use Refresh Token',
    description: 'If enabled, it will automatically sync the Grafana server administrator role',
    type: 'switch',
  },
  configureTLS: {
    label: 'Configure TLS',
    type: 'switch',
  },
  tlsClientCa: {
    label: 'TLS Client CA',
    description: 'The path to the trusted certificate authority list',
    type: 'text',
  },
  tlsClientCert: {
    label: 'TLS Client Cert',
    type: 'text',
  },
  tlsClientKey: {
    label: 'TLS Client Key',
    description: 'The path to the key',
    type: 'text',
  },
  tlsSkipVerifyInsecure: {
    label: 'TLS Skip Verify',
    description:
      'If enabled, the client accepts any certificate presented by the server and any host \n' +
      'name in that certificate. You should only use this for testing, because this mode leaves \n' +
      'SSL/TLS susceptible to man-in-the-middle attacks.',
    type: 'switch',
  },
  groupsAttributePath: {
    label: 'Groups attribute path',
    description:
      'JMESPath expression to use for user group lookup. If you configure allowed_groups, \n' +
      'you must also configure groups_attribute_path.',
    type: 'text',
  },
  teamsUrl: {
    label: 'Teams URL',
    description:
      'The URL used to query for team IDs. If not set, the default value is /teams. \n' +
      'If you configure teams_url, you must also configure team_ids_attribute_path.',
    type: 'text',
  },
  teamIdsAttributePath: {
    label: 'Team IDs attribute path',
    description:
      'The JMESPath expression to use for Grafana team ID lookup within the results returned by the teams_url endpoint.',
    type: 'text',
  },
};

// Check if a string contains only numeric values
function isNumeric(value: string) {
  return /^-?\d+$/.test(value);
}
