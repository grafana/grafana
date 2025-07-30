import { validate as uuidValidate } from 'uuid';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { TextLink } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { ServerDiscoveryField } from './components/ServerDiscoveryField';
import { FieldData, SSOProvider, SSOSettingsField } from './types';
import { isSelectableValue, isSelectableValueArray } from './utils/guards';
import { isUrlValid, isValidDomain } from './utils/url';

type Section = Record<
  SSOProvider['provider'],
  Array<{
    name: string;
    id: string;
    hidden?: boolean;
    fields: SSOSettingsField[];
  }>
>;

export const getSectionFields = (): Section => {
  const generalSettingsLabel = t('auth-config.fields.section-general-settings', 'General settings');
  const userMappingLabel = t('auth-config.fields.section-user-mapping', 'User mapping');
  const extraSecurityLabel = t('auth-config.fields.section-extra-security', 'Extra security measures');

  return {
    azuread: [
      {
        name: generalSettingsLabel,
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
          'loginPrompt',
        ],
      },
      {
        name: userMappingLabel,
        id: 'user',
        fields: ['roleAttributeStrict', 'orgMapping', 'allowAssignGrafanaAdmin', 'skipOrgRoleSync'],
      },
      {
        name: extraSecurityLabel,
        id: 'extra',
        fields: [
          'allowedOrganizations',
          'allowedDomains',
          'allowedGroups',
          'forceUseGraphApi',
          'domainHint',
          'usePkce',
          'useRefreshToken',
          'tlsSkipVerifyInsecure',
          'tlsClientCert',
          'tlsClientKey',
          'tlsClientCa',
          'workloadIdentityTokenFile',
        ],
      },
    ],
    generic_oauth: [
      {
        name: generalSettingsLabel,
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
          'loginPrompt',
        ],
      },
      {
        name: userMappingLabel,
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
        name: extraSecurityLabel,
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
        name: generalSettingsLabel,
        id: 'general',
        fields: [
          'name',
          'clientId',
          'clientSecret',
          'scopes',
          'allowSignUp',
          'autoLogin',
          'signoutRedirectUrl',
          'loginPrompt',
        ],
      },
      {
        name: userMappingLabel,
        id: 'user',
        fields: [
          'roleAttributePath',
          'roleAttributeStrict',
          'orgMapping',
          'allowAssignGrafanaAdmin',
          'skipOrgRoleSync',
        ],
      },
      {
        name: extraSecurityLabel,
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
        name: generalSettingsLabel,
        id: 'general',
        fields: [
          'name',
          'clientId',
          'clientSecret',
          'scopes',
          'allowSignUp',
          'autoLogin',
          'signoutRedirectUrl',
          'loginPrompt',
        ],
      },
      {
        name: userMappingLabel,
        id: 'user',
        fields: [
          'roleAttributePath',
          'roleAttributeStrict',
          'orgMapping',
          'allowAssignGrafanaAdmin',
          'skipOrgRoleSync',
        ],
      },
      {
        name: extraSecurityLabel,
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
        name: generalSettingsLabel,
        id: 'general',
        fields: [
          'name',
          'clientId',
          'clientSecret',
          'scopes',
          'allowSignUp',
          'autoLogin',
          'signoutRedirectUrl',
          'loginPrompt',
        ],
      },
      {
        name: userMappingLabel,
        id: 'user',
        fields: [
          'roleAttributePath',
          'roleAttributeStrict',
          'orgMapping',
          'allowAssignGrafanaAdmin',
          'skipOrgRoleSync',
        ],
      },
      {
        name: extraSecurityLabel,
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
        name: generalSettingsLabel,
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
        name: userMappingLabel,
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
        name: extraSecurityLabel,
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
};

// These field names should not be translated because they refer to specific technical terminology.
// We put them in variables so they can be referred to in otherwise translated descriptions and not
// risk being translated.
const clientIDLabel = 'Client ID';
const clientSecretLabel = 'Client secret';
const scopesLabel = 'Scopes';
const openIDConnectDiscoveryLabel = 'OpenID Connect Discovery URL';
const authURLLabel = 'Auth URL';
const tokenURLLabel = 'Token URL';
const apiURLLabel = 'API URL';
const jmesPathLabel = 'JMESPath';
const workloadIdentityLabel = 'Workload identity';

/**
 * List all the fields that can be used in the form
 */
export function fieldMap(provider: string): Record<string, FieldData> {
  const orgMappingLabel = t('auth-config.fields.organization-mapping-label', 'Organization mapping');
  const orgAttributePathLabel = t(
    'auth-config.fields.organization-attribute-path-label',
    'Organization attribute path'
  );

  const teamsURLLabel = t('auth-config.fields.teams-url-label', 'Teams URL');
  const teamIDsAttributePathLabel = t('auth-config.fields.team-ids-attribute-path-label', 'Team IDs attribute path');

  const allowedGroupsLabel = t('auth-config.fields.allowed-groups-label', 'Allowed groups');
  const groupsAttributePathLabel = t('auth-config.fields.groups-attribute-path-label', 'Groups attribute path');
  const teamIDsLabel = t('auth-config.fields.team-ids-label', 'Team IDs');
  const allowedDomainsLabel = t('auth-config.fields.allowed-domains-label', 'Allowed domains');

  return {
    clientAuthentication: {
      label: t('auth-config.fields.client-authentication-label', 'Client authentication'),
      type: 'select',
      description: t(
        'auth-config.fields.client-authentication-description',
        'The client authentication method used to authenticate to the token endpoint.'
      ),
      multi: false,
      options: clientAuthenticationOptions(provider),
      defaultValue: { value: 'none', label: t('auth-config.field-map.label.none', 'None') },
      validation: {
        required: true,
        message: t('auth-config.fields.required', 'This field is required'),
      },
    },
    clientId: {
      label: clientIDLabel,
      type: 'text',
      description: t('auth-config.fields.client-id-description', 'The {{ clientIDLabel }} of your OAuth2 app.', {
        clientIDLabel,
      }),
      validation: {
        required: true,
        message: t('auth-config.fields.required', 'This field is required'),
      },
    },
    clientSecret: {
      label: clientSecretLabel,
      type: 'secret',
      description: t(
        'auth-config.fields.client-secret-description',
        'The {{ clientSecretLabel }} of your OAuth2 app.',
        {
          clientSecretLabel,
        }
      ),
    },
    managedIdentityClientId: {
      label: t('auth-config.fields.managed-identity-client-id-label', 'FIC managed identity client ID'),
      type: 'text',
      description: t(
        'auth-config.fields.managed-identity-client-id-description',
        'The managed identity client ID of the federated identity credential of your OAuth2 app.'
      ),
    },
    federatedCredentialAudience: {
      label: t('auth-config.fields.federated-credential-audience-label', 'FIC audience'),
      type: 'text',
      description: t(
        'auth-config.fields.federated-credential-audience-description',
        'The audience of the federated identity credential of your OAuth2 app.'
      ),
    },
    workloadIdentityTokenFile: {
      label: t('auth-config.fields.workload-identity-token-file-label', '{{ workloadIdentityLabel }} token file', {
        workloadIdentityLabel,
      }),
      type: 'text',
      description: t(
        'auth-config.fields.workload-identity-token-file-description',
        'The file path to the token file used to authenticate to the OAuth2 provider. This is only required when client authentication is set to "workload_identity". Defaults to /var/run/secrets/azure/tokens/azure-identity-token.'
      ),
      validation: {
        validate: (value, formValues) => {
          let clientAuth = formValues.clientAuthentication;
          if (isSelectableValue<string>(clientAuth)) {
            clientAuth = clientAuth.value;
          }
          if (clientAuth === 'workload_identity') {
            return !!value;
          }
          return true;
        },
        message: t(
          'auth-config.fields.workload-identity-token-file-required',
          'This field must be set when client authentication is set to "Workload identity".'
        ),
      },
    },
    allowedOrganizations: {
      label: t('auth-config.fields.allowed-organizations-label', 'Allowed organizations'),
      type: 'select',
      description: t(
        'auth-config.fields.allowed-organizations-description',
        'List of comma- or space-separated organizations. The user should be a member \nof at least one organization to log in.'
      ),
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: t(
        'auth-config.fields.allowed-organizations-placeholder',
        'Enter organizations (my-team, myteam...) and press Enter to add'
      ),
    },
    allowedDomains: {
      label: allowedDomainsLabel,
      type: 'select',
      description: t(
        'auth-config.fields.allowed-domains-description',
        'List of comma- or space-separated domains. The user should belong to at least \none domain to log in.'
      ),
      multi: true,
      allowCustomValue: true,
      options: [],
    },
    authUrl: {
      label: authURLLabel,
      type: 'text',
      description: t('auth-config.fields.auth-url-description', 'The authorization endpoint of your OAuth2 provider.'),
      validation: {
        required: true,
        validate: (value) => {
          return isUrlValid(value);
        },
        message: t('auth-config.fields.auth-url-required', 'This field is required and must be a valid URL.'),
      },
    },
    authStyle: {
      label: t('auth-config.fields.auth-style-label', 'Auth style'),
      type: 'select',
      description: t(
        'auth-config.fields.auth-style-description',
        'It determines how "{{ clientIDLabel }}" and "{{ clientSecretLabel }}" are sent to Oauth2 provider. Default is AutoDetect.',
        { clientIDLabel, clientSecretLabel }
      ),
      multi: false,
      options: [
        /* eslint-disable @grafana/i18n/no-untranslated-strings */
        { value: 'AutoDetect', label: 'AutoDetect' },
        { value: 'InParams', label: 'InParams' },
        { value: 'InHeader', label: 'InHeader' },
      ],
      defaultValue: { value: 'AutoDetect', label: 'AutoDetect' },
      /* eslint-enable @grafana/i18n/no-untranslated-strings */
    },
    tokenUrl: {
      label: tokenURLLabel,
      type: 'text',
      description: t('auth-config.fields.token-url-description', 'The token endpoint of your OAuth2 provider.'),
      validation: {
        required: true,
        validate: (value) => {
          return isUrlValid(value);
        },
        message: t('auth-config.fields.token-url-required', 'This field is required and must be a valid URL.'),
      },
    },
    scopes: {
      label: scopesLabel,
      type: 'select',
      description: t(
        'auth-config.fields.scopes-description',
        'List of comma- or space-separated OAuth2 {{ scopesLabel }}.',
        {
          scopesLabel,
        }
      ),
      multi: true,
      allowCustomValue: true,
      options: [],
    },
    allowedGroups: {
      label: allowedGroupsLabel,
      type: 'select',
      description: (
        <>
          <Trans i18nKey="auth-config.fields.allowed-groups-description">
            List of comma- or space-separated groups. The user should be a member of at least one group to log in.
          </Trans>{' '}
          {provider === 'generic_oauth' &&
            t(
              'auth-config.fields.allowed-groups-description-oauth',
              'If you configure "{{ allowedGroupsLabel }}", you must also configure "{{ groupsAttributePathLabel }}".',
              { allowedGroupsLabel, groupsAttributePathLabel }
            )}
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
                if (isSelectableValueArray(value)) {
                  return value.every((v) => v?.value && uuidValidate(v.value));
                }
                return true;
              },
              message: t(
                'auth-config.fields.allowed-groups-object-ids',
                '{{ allowedGroupsLabel }} must be {{ objectIDsField }}.',
                {
                  objectIDsField: 'Object IDs',
                }
              ),
            }
          : undefined,
    },
    apiUrl: {
      label: apiURLLabel,
      type: 'text',
      description: (
        <Trans i18nKey="auth-config.fields.api-url-description">
          The user information endpoint of your OAuth2 provider. Information returned by this endpoint must be
          compatible with{' '}
          <TextLink href={'https://connect2id.com/products/server/docs/api/userinfo'} external variant={'bodySmall'}>
            OpenID UserInfo
          </TextLink>
          .
        </Trans>
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
        message: t('auth-config.fields.api-url-required', 'This field must be a valid URL if set.'),
      },
    },
    roleAttributePath: {
      label: t('auth-config.fields.role-attribute-path-label', 'Role attribute path'),
      description: t(
        'auth-config.fields.role-attribute-path-description',
        '{{ jmesPathLabel }} expression to use for Grafana role lookup.',
        { jmesPathLabel }
      ),
      type: 'text',
      validation: {
        required: false,
      },
    },
    name: {
      label: t('auth-config.fields.display-name-label', 'Display name'),
      description: t(
        'auth-config.fields.display-name-description',
        'Will be displayed on the login page as "Sign in with ...". Helpful if you use more than one identity providers or SSO protocols.'
      ),
      type: 'text',
    },
    allowSignUp: {
      label: t('auth-config.fields.allow-sign-up-label', 'Allow sign up'),
      description: t(
        'auth-config.fields.allow-sign-up-description',
        'If not enabled, only existing Grafana users can log in using OAuth.'
      ),
      type: 'switch',
    },
    autoLogin: {
      label: t('auth-config.fields.auto-login-label', 'Auto login'),
      description: t('auth-config.fields.auto-login-description', 'Log in automatically, skipping the login screen.'),
      type: 'switch',
    },
    signoutRedirectUrl: {
      label: t('auth-config.fields.signout-redirect-url-label', 'Sign out redirect URL'),
      description: t(
        'auth-config.fields.signout-redirect-url-description',
        'The URL to redirect the user to after signing out from Grafana.'
      ),
      type: 'text',
      validation: {
        required: false,
      },
    },
    emailAttributeName: {
      label: t('auth-config.fields.email-attribute-name-label', 'Email attribute name'),
      description: t(
        'auth-config.fields.email-attribute-name-description',
        'Name of the key to use for user email lookup within the attributes map of OAuth2 ID token.'
      ),
      type: 'text',
    },
    emailAttributePath: {
      label: t('auth-config.fields.email-attribute-path-label', 'Email attribute path'),
      description: t(
        'auth-config.fields.email-attribute-path-description',
        'JMESPath expression to use for user email lookup from the user information.'
      ),
      type: 'text',
    },
    nameAttributePath: {
      label: t('auth-config.fields.name-attribute-path-label', 'Name attribute path'),
      description: t(
        'auth-config.fields.name-attribute-path-description',
        "JMESPath expression to use for user name lookup from the user ID token. \nThis name will be used as the user's display name."
      ),
      type: 'text',
    },
    loginAttributePath: {
      label: t('auth-config.fields.login-attribute-path-label', 'Login attribute path'),
      description: t(
        'auth-config.fields.login-attribute-path-description',
        'JMESPath expression to use for user login lookup from the user ID token.'
      ),
      type: 'text',
    },
    idTokenAttributeName: {
      label: t('auth-config.fields.id-token-attribute-name-label', 'ID token attribute name'),
      description: t(
        'auth-config.fields.id-token-attribute-name-description',
        'The name of the key used to extract the ID token from the returned OAuth2 token.'
      ),
      type: 'text',
    },
    roleAttributeStrict: {
      label: t('auth-config.fields.role-attribute-strict-label', 'Role attribute strict mode'),
      description: t(
        'auth-config.fields.role-attribute-strict-description',
        'If enabled, denies user login if the Grafana role cannot be extracted using Role attribute path.'
      ),
      type: 'switch',
    },
    allowAssignGrafanaAdmin: {
      label: t('auth-config.fields.allow-assign-grafana-admin-label', 'Allow assign Grafana admin'),
      description: t(
        'auth-config.fields.allow-assign-grafana-admin-description',
        'If enabled, it will automatically sync the Grafana server administrator role.'
      ),
      type: 'switch',
      hidden: !contextSrv.isGrafanaAdmin,
    },
    skipOrgRoleSync: {
      label: t('auth-config.fields.skip-org-role-sync-label', 'Skip organization role sync'),
      description: t(
        'auth-config.fields.skip-org-role-sync-description',
        "Prevent synchronizing users' organization roles from your IdP."
      ),
      type: 'switch',
    },
    orgMapping: {
      label: orgMappingLabel,
      description: orgMappingDescription(provider),
      type: 'select',
      hidden: !contextSrv.isGrafanaAdmin,
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: t(
        'auth-config.fields.organization-mapping-placeholder',
        'Enter mappings (my-team:1:Viewer...) and press Enter to add'
      ),
    },
    orgAttributePath: {
      label: orgAttributePathLabel,
      description: t(
        'auth-config.fields.organization-attribute-path-description',
        'JMESPath expression to use for organization lookup. If you configure "{{ orgMappingLabel }}", you must also configure "{{ orgAttributePathLabel }}".',
        { orgMappingLabel, orgAttributePathLabel }
      ),
      type: 'text',
      hidden: !(['generic_oauth', 'okta'].includes(provider) && contextSrv.isGrafanaAdmin),
    },
    defineAllowedGroups: {
      label: t('auth-config.fields.define-allowed-groups-label', 'Define allowed groups'),
      type: 'switch',
    },
    defineAllowedTeamsIds: {
      label: t('auth-config.fields.define-allowed-teams-ids-label', 'Define allowed teams IDs'),
      type: 'switch',
    },
    forceUseGraphApi: {
      label: t('auth-config.fields.force-use-graph-api-label', 'Force use Graph API'),
      description: t(
        'auth-config.fields.force-use-graph-api-description',
        "If enabled, Grafana will fetch the users' groups using the Microsoft Graph API."
      ),
      type: 'checkbox',
    },
    usePkce: {
      label: t('auth-config.fields.use-pkce-label', 'Use PKCE'),
      description: (
        <Trans i18nKey="auth-config.fields.use-pkce-description">
          If enabled, Grafana will use{' '}
          <TextLink external variant={'bodySmall'} href={'https://datatracker.ietf.org/doc/html/rfc7636'}>
            Proof Key for Code Exchange (PKCE)
          </TextLink>{' '}
          with the OAuth2 Authorization Code Grant.
        </Trans>
      ),
      type: 'checkbox',
    },
    useRefreshToken: {
      label: t('auth-config.fields.use-refresh-token-label', 'Use refresh token'),
      description: t(
        'auth-config.fields.use-refresh-token-description',
        'If enabled, Grafana will fetch a new access token using the refresh token provided by the OAuth2 provider.'
      ),
      type: 'checkbox',
    },
    tlsClientCa: {
      label: t('auth-config.fields.tls-client-ca-label', 'TLS client CA'),
      description: t(
        'auth-config.fields.tls-client-ca-description',
        'The file path to the trusted certificate authority list. Is not applicable on Grafana Cloud.'
      ),
      type: 'text',
      hidden: !config.localFileSystemAvailable,
    },
    tlsClientCert: {
      label: t('auth-config.fields.tls-client-cert-label', 'TLS client cert'),
      description: t(
        'auth-config.fields.tls-client-cert-description',
        'The file path to the certificate. Is not applicable on Grafana Cloud.'
      ),
      type: 'text',
      hidden: !config.localFileSystemAvailable,
    },
    tlsClientKey: {
      label: t('auth-config.fields.tls-client-key-label', 'TLS client key'),
      description: t(
        'auth-config.fields.tls-client-key-description',
        'The file path to the key. Is not applicable on Grafana Cloud.'
      ),
      type: 'text',
      hidden: !config.localFileSystemAvailable,
    },
    tlsSkipVerifyInsecure: {
      label: t('auth-config.fields.tls-skip-verify-label', 'TLS skip verify'),
      description: t(
        'auth-config.fields.tls-skip-verify-description',
        'If enabled, the client accepts any certificate presented by the server and any host \nname in that certificate. You should only use this for testing, because this mode leaves \nSSL/TLS susceptible to man-in-the-middle attacks.'
      ),
      type: 'switch',
    },
    groupsAttributePath: {
      label: groupsAttributePathLabel,
      description: t(
        'auth-config.fields.groups-attribute-path-description',
        'JMESPath expression to use for user group lookup. If you configure "{{ allowedGroupsLabel }}", \nyou must also configure "{{ groupsAttributePathLabel }}".',
        { allowedGroupsLabel, groupsAttributePathLabel }
      ),
      type: 'text',
    },
    teamsUrl: {
      label: teamsURLLabel,
      description: (
        <>
          <Trans i18nKey="auth-config.fields.teams-url-description">
            The URL used to query for Team IDs. If not set, the default value is /teams.
          </Trans>{' '}
          {provider === 'generic_oauth' &&
            t(
              'auth-config.fields.teams-url-description-oauth',
              'If you configure "{{ teamsURLLabel }}", you must also configure "{{ teamIDsAttributePathLabel }}".',
              { teamsURLLabel, teamIDsAttributePathLabel }
            )}
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
        message: t(
          'auth-config.fields.teams-url-required',
          'This field must be set if "{{ teamIDsLabel }}" are configured and must be a valid URL.',
          { teamIDsLabel }
        ),
      },
    },
    teamIdsAttributePath: {
      label: teamIDsAttributePathLabel,
      description: t(
        'auth-config.fields.team-ids-attribute-path-description',
        'The JMESPath expression to use for Grafana Team ID lookup within the results returned by the "{{ teamsURLLabel }}" endpoint.',
        { teamsURLLabel }
      ),
      type: 'text',
      validation: {
        validate: (value, formValues) => {
          if (formValues.teamIds.length) {
            return !!value;
          }
          return true;
        },
        message: t(
          'auth-config.fields.team-ids-attribute-path-required',
          'This field must be set if "{{ teamIDsLabel }}" are configured.',
          { teamIDsLabel }
        ),
      },
    },
    teamIds: {
      label: teamIDsLabel,
      type: 'select',
      description: (
        <>
          {provider === 'github'
            ? t('auth-config.fields.team-ids-github', 'Integer list of Team IDs.')
            : t('auth-config.fields.team-ids-other', 'String list of Team IDs.')}{' '}
          <Trans i18nKey="auth-config.fields.team-ids-description">
            If set, the user must be a member of one of the given teams to log in.
          </Trans>{' '}
          {provider === 'generic_oauth' &&
            t(
              'auth-config.fields.team-ids-description-oauth',
              'If you configure "{{ teamIDsLabel }}", you must also configure "{{ teamsURLLabel }}" and "{{ teamIDsAttributePathLabel }}".',
              { teamIDsLabel, teamsURLLabel, teamIDsAttributePathLabel }
            )}
        </>
      ),
      multi: true,
      allowCustomValue: true,
      options: [],
      placeholder: t('auth-config.fields.team-ids-placeholder', 'Enter Team IDs and press Enter to add'),
      validation:
        provider === 'github'
          ? {
              validate: (value) => {
                if (typeof value === 'string') {
                  return isNumeric(value);
                }
                if (isSelectableValueArray(value)) {
                  return value.every((v) => v?.value && isNumeric(v.value));
                }
                return true;
              },
              message: t('auth-config.fields.team-ids-numbers', 'Team IDs must be numbers.'),
            }
          : undefined,
    },
    hostedDomain: {
      label: t('auth-config.fields.hosted-domain-label', 'Hosted domain'),
      description: t(
        'auth-config.fields.hosted-domain-description',
        'The domain under which Grafana is hosted and accessible.'
      ),
      type: 'text',
    },
    validateHd: {
      label: t('auth-config.fields.validate-hosted-domain-label', 'Validate hosted domain'),
      description: t(
        'auth-config.fields.validate-hosted-domain-description',
        'If enabled, Grafana will match the Hosted Domain retrieved from the Google ID Token against the "{{ allowedDomainsLabel }}" list specified by the user.',
        { allowedDomainsLabel }
      ),
      type: 'checkbox',
    },
    serverDiscoveryUrl: {
      label: openIDConnectDiscoveryLabel,
      description: t(
        'auth-config.fields.server-discovery-url-description',
        'The .well-known/openid-configuration endpoint for your IdP. The info extracted from this URL will be used to populate the "{{ authURLLabel }}", "{{ tokenURLLabel }}" and "{{ apiURLLabel }}" fields.',
        { authURLLabel, tokenURLLabel, apiURLLabel }
      ),
      type: 'custom',
      content: (setValue) => <ServerDiscoveryField setValue={setValue} />,
    },
    domainHint: {
      label: t('auth-config.fields.domain-hint-label', 'Domain hint'),
      description: t(
        'auth-config.fields.domain-hint-description',
        'Parameter to indicate the realm of the user in the Azure AD/Entra ID tenant and streamline the login process.'
      ),
      type: 'text',
      validation: {
        validate: (value) => {
          if (typeof value === 'string' && value.length) {
            return isValidDomain(value);
          }
          return true;
        },
        message: t('auth-config.fields.domain-hint-valid-domain', 'This field must be a valid domain.'),
      },
    },
    loginPrompt: {
      label: t('auth-config.fields.login-prompt-label', 'Login prompt'),
      type: 'select',
      description: t(
        'auth-config.fields.login-prompt-description',
        'Indicates the type of user interaction when the user logs in with the IdP.'
      ),
      multi: false,
      options: [
        { value: '', label: '' },
        { value: 'login', label: t('auth-config.fields.login-prompt-login', 'Login') },
        { value: 'consent', label: t('auth-config.fields.login-prompt-consent', 'Consent') },
        { value: 'select_account', label: t('auth-config.fields.login-prompt-select-account', 'Select account') },
      ],
      defaultValue: { value: '', label: '' },
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
      return t(
        'auth-config.fields.org-mapping-description-azuread',
        'List of "<GroupID>:<OrgIdOrName>:<Role>" mappings.'
      );
    case 'github':
      return t(
        'auth-config.fields.org-mapping-description-github',
        'List of "<GitHubTeamName>:<OrgIdOrName>:<Role>" mappings.'
      );
    case 'gitlab':
      return t(
        'auth-config.fields.org-mapping-description-gitlab',
        'List of "<GitlabGroupName>:<OrgIdOrName>:<Role>" mappings.'
      );
    case 'google':
      return t(
        'auth-config.fields.org-mapping-description-google',
        'List of "<GoogleGroupName>:<OrgIdOrName>:<Role>" mappings.'
      );
    default:
      // Generic OAuth, Okta
      return t(
        'auth-config.fields.org-mapping-description-generic',
        'List of "<ExternalName>:<OrgIdOrName>:<Role>" mappings.'
      );
  }
}

function clientAuthenticationOptions(provider: string): Array<SelectableValue<string>> {
  // Other options are purposefully not translated
  /* eslint-disable @grafana/i18n/no-untranslated-strings */
  switch (provider) {
    case 'azuread':
      return [
        { value: 'none', label: t('auth-config.fields.client-authentication-none', 'None') },
        { value: 'client_secret_post', label: 'Client secret' },
        { value: 'managed_identity', label: 'Managed identity' },
        { value: 'workload_identity', label: 'Workload identity' },
      ];
    // Other providers ...
    default:
      return [
        { value: 'none', label: 'None' },
        { value: 'client_secret_post', label: 'Client secret' },
      ];
  }
  /* eslint-enable @grafana/i18n/no-untranslated-strings */
}
