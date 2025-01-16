import { validate as uuidValidate } from 'uuid';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TextLink } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { ServerDiscoveryField } from './components/ServerDiscoveryField';
import { FieldData, SSOProvider, SSOSettingsField } from './types';
import { isSelectableValue } from './utils/guards';
import { isUrlValid } from './utils/url';

type Section = Record<
  SSOProvider['provider'],
  Array<{
    name: string;
    id: string;
    hidden?: boolean;
    fields: SSOSettingsField[];
  }>
>;

export const sectionFields: Section = {
  azuread: [
    {
      name: 'General settings',
      id: 'general',
      fields: [
        'name',
        'clientAuthentication',
        'clientId',
        'clientSecret',
        'managedIdentityClientId',
        'federatedCredentialAudience',
        'scopes',
        'authUrl',
        'tokenUrl',
        'allowSignUp',
        'autoLogin',
        'signoutRedirectUrl',
      ],
    },
    {
      name: 'User mapping',
      id: 'user',
      fields: ['roleAttributeStrict', 'orgMapping', 'allowAssignGrafanaAdmin', 'skipOrgRoleSync'],
    },
    {
      name: 'Extra security measures',
      id: 'extra',
      fields: [
        'allowedOrganizations',
        'allowedDomains',
        'allowedGroups',
        'forceUseGraphApi',
        'usePkce',
        'useRefreshToken',
        'tlsSkipVerifyInsecure',
        'tlsClientCert',
        'tlsClientKey',
        'tlsClientCa',
      ],
    },
  ],
  generic_oauth: [
    {
      name: 'General settings',
      id: 'general',
      fields: [
        'name',
        'clientId',
        'clientSecret',
        'authStyle',
        'scopes',
        'serverDiscoveryUrl',
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
        'orgMapping',
        'orgAttributePath',
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
        'tlsSkipVerifyInsecure',
        'tlsClientCert',
        'tlsClientKey',
        'tlsClientCa',
      ],
    },
  ],
  google: [
    {
      name: 'General settings',
      id: 'general',
      fields: ['name', 'clientId', 'clientSecret', 'scopes', 'allowSignUp', 'autoLogin', 'signoutRedirectUrl'],
    },
    {
      name: 'User mapping',
      id: 'user',
      fields: ['roleAttributePath', 'roleAttributeStrict', 'orgMapping', 'allowAssignGrafanaAdmin', 'skipOrgRoleSync'],
    },
    {
      name: 'Extra security measures',
      id: 'extra',
      fields: [
        'validateHd',
        'hostedDomain',
        'allowedDomains',
        'allowedGroups',
        'usePkce',
        'useRefreshToken',
        'tlsSkipVerifyInsecure',
        'tlsClientCert',
        'tlsClientKey',
        'tlsClientCa',
      ],
    },
  ],
  github: [
    {
      name: 'General settings',
      id: 'general',
      fields: ['name', 'clientId', 'clientSecret', 'scopes', 'allowSignUp', 'autoLogin', 'signoutRedirectUrl'],
    },
    {
      name: 'User mapping',
      id: 'user',
      fields: ['roleAttributePath', 'roleAttributeStrict', 'orgMapping', 'allowAssignGrafanaAdmin', 'skipOrgRoleSync'],
    },
    {
      name: 'Extra security measures',
      id: 'extra',
      fields: [
        'allowedOrganizations',
        'allowedDomains',
        'teamIds',
        'usePkce',
        'useRefreshToken',
        'tlsSkipVerifyInsecure',
        'tlsClientCert',
        'tlsClientKey',
        'tlsClientCa',
      ],
    },
  ],
  gitlab: [
    {
      name: 'General settings',
      id: 'general',
      fields: ['name', 'clientId', 'clientSecret', 'scopes', 'allowSignUp', 'autoLogin', 'signoutRedirectUrl'],
    },
    {
      name: 'User mapping',
      id: 'user',
      fields: ['roleAttributePath', 'roleAttributeStrict', 'orgMapping', 'allowAssignGrafanaAdmin', 'skipOrgRoleSync'],
    },
    {
      name: 'Extra security measures',
      id: 'extra',
      fields: [
        'allowedDomains',
        'allowedGroups',
        'usePkce',
        'useRefreshToken',
        'tlsSkipVerifyInsecure',
        'tlsClientCert',
        'tlsClientKey',
        'tlsClientCa',
      ],
    },
  ],
  okta: [
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
        'roleAttributePath',
        'roleAttributeStrict',
        'orgMapping',
        'orgAttributePath',
        'allowAssignGrafanaAdmin',
        'skipOrgRoleSync',
      ],
    },
    {
      name: 'Extra security measures',
      id: 'extra',
      fields: [
        'allowedDomains',
        'allowedGroups',
        'usePkce',
        'useRefreshToken',
        'tlsSkipVerifyInsecure',
        'tlsClientCert',
        'tlsClientKey',
        'tlsClientCa',
      ],
    },
  ],
};

/**
 * List all the fields that can be used in the form
 */
export function fieldMap(provider: string): Record<string, FieldData> {
  return {
    clientAuthentication: {
      label: 'Client authentication',
      type: 'select',
      description: 'The client authentication method used to authenticate to the token endpoint.',
      multi: false,
      options: clientAuthenticationOptions(provider),
      defaultValue: { value: 'none', label: 'None' },
      validation: {
        required: true,
        message: 'This field is required',
      },
    },
    clientId: {
      label: 'Client Id',
      type: 'text',
      description: 'The client Id of your OAuth2 app.',
      validation: {
        required: true,
        message: 'This field is required',
      },
    },
    clientSecret: {
      label: 'Client secret',
      type: 'secret',
      description: 'The client secret of your OAuth2 app.',
    },
    managedIdentityClientId: {
      label: 'FIC managed identity client Id',
      type: 'text',
      description: 'The managed identity client Id of the federated identity credential of your OAuth2 app.',
    },
    federatedCredentialAudience: {
      label: 'FIC audience',
      type: 'text',
      description: 'The audience of the federated identity credential of your OAuth2 app.',
    },
    allowedOrganizations: {
      label: 'Allowed organizations',
      type: 'select',
      description:
        'List of comma- or space-separated organizations. The user should be a member \n' +
        'of at least one organization to log in.',
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: 'Enter organizations (my-team, myteam...) and press Enter to add',
    },
    allowedDomains: {
      label: 'Allowed domains',
      type: 'select',
      description:
        'List of comma- or space-separated domains. The user should belong to at least \n' + 'one domain to log in.',
      multi: true,
      allowCustomValue: true,
      options: [],
    },
    authUrl: {
      label: 'Auth URL',
      type: 'text',
      description: 'The authorization endpoint of your OAuth2 provider.',
      validation: {
        required: true,
        validate: (value) => {
          return isUrlValid(value);
        },
        message: 'This field is required and must be a valid URL.',
      },
    },
    authStyle: {
      label: 'Auth style',
      type: 'select',
      description: 'It determines how client_id and client_secret are sent to Oauth2 provider. Default is AutoDetect.',
      multi: false,
      options: [
        { value: 'AutoDetect', label: 'AutoDetect' },
        { value: 'InParams', label: 'InParams' },
        { value: 'InHeader', label: 'InHeader' },
      ],
      defaultValue: { value: 'AutoDetect', label: 'AutoDetect' },
    },
    tokenUrl: {
      label: 'Token URL',
      type: 'text',
      description: 'The token endpoint of your OAuth2 provider.',
      validation: {
        required: true,
        validate: (value) => {
          return isUrlValid(value);
        },
        message: 'This field is required and must be a valid URL.',
      },
    },
    scopes: {
      label: 'Scopes',
      type: 'select',
      description: 'List of comma- or space-separated OAuth2 scopes.',
      multi: true,
      allowCustomValue: true,
      options: [],
    },
    allowedGroups: {
      label: 'Allowed groups',
      type: 'select',
      description: (
        <>
          List of comma- or space-separated groups. The user should be a member of at least one group to log in.{' '}
          {provider === 'generic_oauth' &&
            'If you configure allowed_groups, you must also configure groups_attribute_path.'}
        </>
      ),
      multi: true,
      allowCustomValue: true,
      options: [],
      validation:
        provider === 'azuread'
          ? {
              validate: (value) => {
                if (typeof value === 'string') {
                  return uuidValidate(value);
                }
                if (isSelectableValue(value)) {
                  return value.every((v) => v?.value && uuidValidate(v.value));
                }
                return true;
              },
              message: 'Allowed groups must be Object Ids.',
            }
          : undefined,
    },
    apiUrl: {
      label: 'API URL',
      type: 'text',
      description: (
        <>
          The user information endpoint of your OAuth2 provider. Information returned by this endpoint must be
          compatible with{' '}
          <TextLink href={'https://connect2id.com/products/server/docs/api/userinfo'} external variant={'bodySmall'}>
            OpenID UserInfo
          </TextLink>
          .
        </>
      ),
      validation: {
        required: false,
        validate: (value) => {
          if (typeof value !== 'string') {
            return false;
          }

          if (value.length) {
            return isUrlValid(value);
          }

          return true;
        },
        message: 'This field must be a valid URL if set.',
      },
    },
    roleAttributePath: {
      label: 'Role attribute path',
      description: 'JMESPath expression to use for Grafana role lookup.',
      type: 'text',
      validation: {
        required: false,
      },
    },
    name: {
      label: 'Display name',
      description:
        'Will be displayed on the login page as "Sign in with ...". Helpful if you use more than one identity providers or SSO protocols.',
      type: 'text',
    },
    allowSignUp: {
      label: 'Allow sign up',
      description: 'If not enabled, only existing Grafana users can log in using OAuth.',
      type: 'switch',
    },
    autoLogin: {
      label: 'Auto login',
      description: 'Log in automatically, skipping the login screen.',
      type: 'switch',
    },
    signoutRedirectUrl: {
      label: 'Sign out redirect URL',
      description: 'The URL to redirect the user to after signing out from Grafana.',
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
      description: 'If enabled, denies user login if the Grafana role cannot be extracted using Role attribute path.',
      type: 'switch',
    },
    allowAssignGrafanaAdmin: {
      label: 'Allow assign Grafana admin',
      description: 'If enabled, it will automatically sync the Grafana server administrator role.',
      type: 'switch',
      hidden: !contextSrv.isGrafanaAdmin,
    },
    skipOrgRoleSync: {
      label: 'Skip organization role sync',
      description: 'Prevent synchronizing users’ organization roles from your IdP.',
      type: 'switch',
    },
    orgMapping: {
      label: 'Organization mapping',
      description: orgMappingDescription(provider),
      type: 'select',
      hidden: !contextSrv.isGrafanaAdmin,
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: 'Enter mappings (my-team:1:Viewer...) and press Enter to add',
    },
    orgAttributePath: {
      label: 'Organization attribute path',
      description: 'JMESPath expression to use for organization lookup.',
      type: 'text',
      hidden: !(['generic_oauth', 'okta'].includes(provider) && contextSrv.isGrafanaAdmin),
    },
    defineAllowedGroups: {
      label: 'Define allowed groups',
      type: 'switch',
    },
    defineAllowedTeamsIds: {
      label: 'Define allowed teams ids',
      type: 'switch',
    },
    forceUseGraphApi: {
      label: 'Force use Graph API',
      description: "If enabled, Grafana will fetch the users' groups using the Microsoft Graph API.",
      type: 'checkbox',
    },
    usePkce: {
      label: 'Use PKCE',
      description: (
        <>
          If enabled, Grafana will use{' '}
          <TextLink external variant={'bodySmall'} href={'https://datatracker.ietf.org/doc/html/rfc7636'}>
            Proof Key for Code Exchange (PKCE)
          </TextLink>{' '}
          with the OAuth2 Authorization Code Grant.
        </>
      ),
      type: 'checkbox',
    },
    useRefreshToken: {
      label: 'Use refresh token',
      description:
        'If enabled, Grafana will fetch a new access token using the refresh token provided by the OAuth2 provider.',
      type: 'checkbox',
    },
    tlsClientCa: {
      label: 'TLS client ca',
      description: 'The file path to the trusted certificate authority list. Is not applicable on Grafana Cloud.',
      type: 'text',
      hidden: !config.localFileSystemAvailable,
    },
    tlsClientCert: {
      label: 'TLS client cert',
      description: 'The file path to the certificate. Is not applicable on Grafana Cloud.',
      type: 'text',
      hidden: !config.localFileSystemAvailable,
    },
    tlsClientKey: {
      label: 'TLS client key',
      description: 'The file path to the key. Is not applicable on Grafana Cloud.',
      type: 'text',
      hidden: !config.localFileSystemAvailable,
    },
    tlsSkipVerifyInsecure: {
      label: 'TLS skip verify',
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
      description: (
        <>
          The URL used to query for Team Ids. If not set, the default value is /teams.{' '}
          {provider === 'generic_oauth' &&
            'If you configure teams_url, you must also configure team_ids_attribute_path.'}
        </>
      ),
      type: 'text',
      validation: {
        validate: (value, formValues) => {
          let result = true;
          if (formValues.teamIds.length) {
            result = !!value;
          }

          if (typeof value === 'string' && value.length) {
            result = isUrlValid(value);
          }
          return result;
        },
        message: 'This field must be set if Team Ids are configured and must be a valid URL.',
      },
    },
    teamIdsAttributePath: {
      label: 'Team Ids attribute path',
      description:
        'The JMESPath expression to use for Grafana Team Id lookup within the results returned by the teams_url endpoint.',
      type: 'text',
      validation: {
        validate: (value, formValues) => {
          if (formValues.teamIds.length) {
            return !!value;
          }
          return true;
        },
        message: 'This field must be set if Team Ids are configured.',
      },
    },
    teamIds: {
      label: 'Team Ids',
      type: 'select',
      description: (
        <>
          {provider === 'github' ? 'Integer' : 'String'} list of Team Ids. If set, the user must be a member of one of
          the given teams to log in.{' '}
          {provider === 'generic_oauth' &&
            'If you configure team_ids, you must also configure teams_url and team_ids_attribute_path.'}
        </>
      ),
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: 'Enter Team Ids and press Enter to add',
      validation:
        provider === 'github'
          ? {
              validate: (value) => {
                if (typeof value === 'string') {
                  return isNumeric(value);
                }
                if (isSelectableValue(value)) {
                  return value.every((v) => v?.value && isNumeric(v.value));
                }
                return true;
              },
              message: 'Team Ids must be numbers.',
            }
          : undefined,
    },
    hostedDomain: {
      label: 'Hosted domain',
      description: 'The domain under which Grafana is hosted and accessible.',
      type: 'text',
    },
    validateHd: {
      label: 'Validate hosted domain',
      description:
        'If enabled, Grafana will match the Hosted Domain retrieved from the Google ID Token against the Allowed Domains list specified by the user.',
      type: 'checkbox',
    },
    serverDiscoveryUrl: {
      label: 'OpenID Connect Discovery URL',
      description:
        'The .well-known/openid-configuration endpoint for your IdP. The info extracted from this URL will be used to populate the Auth URL, Token URL and API URL fields.',
      type: 'custom',
      content: (setValue) => <ServerDiscoveryField setValue={setValue} />,
    },
  };
}

// Check if a string contains only numeric values
function isNumeric(value: string) {
  return /^-?\d+$/.test(value);
}

function orgMappingDescription(provider: string): string {
  switch (provider) {
    case 'azuread':
      return 'List of "<GroupID>:<OrgIdOrName>:<Role>" mappings.';
    case 'github':
      return 'List of "<GitHubTeamName>:<OrgIdOrName>:<Role>" mappings.';
    case 'gitlab':
      return 'List of "<GitlabGroupName>:<OrgIdOrName>:<Role>';
    case 'google':
      return 'List of "<GoogleGroupName>:<OrgIdOrName>:<Role>';
    default:
      // Generic OAuth, Okta
      return 'List of "<ExternalName>:<OrgIdOrName>:<Role>" mappings.';
  }
}

function clientAuthenticationOptions(provider: string): Array<SelectableValue<string>> {
  switch (provider) {
    case 'azuread':
      return [
        { value: 'none', label: 'None' },
        { value: 'client_secret_post', label: 'Client secret' },
        { value: 'managed_identity', label: 'Managed identity' },
      ];
    // Other providers ...
    default:
      return [
        { value: 'none', label: 'None' },
        { value: 'client_secret_post', label: 'Client secret' },
      ];
  }
}
