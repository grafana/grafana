import { css } from '@emotion/css';
import { SyntheticEvent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfigSection, ConfigSubSection, DataSourceDescription } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { ConnectionLimits, useMigrateDatabaseFields } from '@grafana/sql';
import { NumberInput } from '@grafana/sql/src/components/configuration/NumberInput';
import {
  Alert,
  FieldSet,
  Input,
  TextLink,
  SecretInput,
  Select,
  useStyles2,
  SecureSocksProxySettings,
  Divider,
  Field,
  Switch,
} from '@grafana/ui';

import { AzureAuthSettings } from '../azureauth/AzureAuthSettings';
import {
  MSSQLAuthenticationType,
  MSSQLEncryptOptions,
  MssqlOptions,
  AzureAuthConfigType,
  MssqlSecureOptions,
} from '../types';

import { KerberosConfig, KerberosAdvancedSettings, UsernameMessage } from './Kerberos';

const LONG_WIDTH = 40;

export const ConfigurationEditor = (props: DataSourcePluginOptionsEditorProps<MssqlOptions, MssqlSecureOptions>) => {
  useMigrateDatabaseFields(props);

  const { options: dsSettings, onOptionsChange } = props;

  const styles = useStyles2(getStyles);
  const jsonData = dsSettings.jsonData;
  const azureAuthIsSupported = config.azureAuthEnabled;

  const azureAuthSettings: AzureAuthConfigType = {
    azureAuthIsSupported,
    azureAuthSettingsUI: AzureAuthSettings,
  };

  const onResetPassword = () => {
    updateDatasourcePluginResetOption(props, 'password');
  };

  const onDSOptionChanged = (property: keyof MssqlOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      onOptionsChange({ ...dsSettings, ...{ [property]: event.currentTarget.value } });
    };
  };

  const onSkipTLSVerifyChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'tlsSkipVerify', event.currentTarget.checked);
  };

  const onEncryptChanged = (value: SelectableValue) => {
    updateDatasourcePluginJsonDataOption(props, 'encrypt', value.value);
  };

  const onAuthenticationMethodChanged = (value: SelectableValue) => {
    onOptionsChange({
      ...dsSettings,
      ...{
        jsonData: {
          ...jsonData,
          ...{ authenticationType: value.value },
          azureCredentials: undefined,
          keytabFilePath: undefined,
          credentialCache: undefined,
          credentialCacheLookupFile: undefined,
        },
        secureJsonData: { ...dsSettings.secureJsonData, ...{ password: '' } },
        secureJsonFields: { ...dsSettings.secureJsonFields, ...{ password: false } },
        user: '',
      },
    });
  };

  const onConnectionTimeoutChanged = (connectionTimeout?: number) => {
    if (connectionTimeout && connectionTimeout < 0) {
      connectionTimeout = 0;
    }
    updateDatasourcePluginJsonDataOption(props, 'connectionTimeout', connectionTimeout);
  };

  const buildAuthenticationOptions = (): Array<SelectableValue<MSSQLAuthenticationType>> => {
    const basicAuthenticationOptions: Array<SelectableValue<MSSQLAuthenticationType>> = [
      { value: MSSQLAuthenticationType.sqlAuth, label: 'SQL Server Authentication' },
      { value: MSSQLAuthenticationType.windowsAuth, label: 'Windows Authentication' },
      { value: MSSQLAuthenticationType.kerberosRaw, label: 'Windows AD: Username + password' },
      { value: MSSQLAuthenticationType.kerberosKeytab, label: 'Windows AD: Keytab file' },
      { value: MSSQLAuthenticationType.kerberosCredentialCache, label: 'Windows AD: Credential cache' },
      { value: MSSQLAuthenticationType.kerberosCredentialCacheLookupFile, label: 'Windows AD: Credential cache file' },
    ];

    if (azureAuthIsSupported) {
      return [
        ...basicAuthenticationOptions,
        { value: MSSQLAuthenticationType.azureAuth, label: MSSQLAuthenticationType.azureAuth },
      ];
    }

    return basicAuthenticationOptions;
  };

  const encryptOptions: Array<SelectableValue<string>> = [
    { value: MSSQLEncryptOptions.disable, label: 'disable' },
    { value: MSSQLEncryptOptions.false, label: 'false' },
    { value: MSSQLEncryptOptions.true, label: 'true' },
  ];

  return (
    <>
      <DataSourceDescription
        dataSourceName="Microsoft SQL Server"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/mssql/"
        hasRequiredFields
      />
      <Alert title={t('configuration.configuration-editor.title-user-permission', 'User Permission')} severity="info">
        <Trans
          i18nKey="configuration.configuration-editor.body-user-permission"
          values={{ permissionType: 'SELECT', example1: 'USE otherdb;', example2: 'DROP TABLE user;' }}
        >
          The database user should only be granted {'{{permissionType}}'} permissions on the specified database and
          tables you want to query. Grafana does not validate that queries are safe so queries can contain any SQL
          statement. For example, statements like <code>{'{{example1}}'}</code> and <code>{'{{example2}}'}</code> would
          be executed. To protect against this we <em>highly</em> recommend you create a specific MS SQL user with
          restricted permissions. Check out the{' '}
          <TextLink external href="http://docs.grafana.org/features/datasources/mssql/">
            Microsoft SQL Server Data Source Docs
          </TextLink>{' '}
          for more information.
        </Trans>
      </Alert>
      <Divider />
      <ConfigSection title={t('configuration.configuration-editor.title-connection', 'Connection')}>
        <Field
          label={t('configuration.configuration-editor.title-host', 'Host')}
          required
          invalid={!dsSettings.url}
          error={t('configuration.configuration-editor.required-host', 'Host is required')}
        >
          <Input
            width={LONG_WIDTH}
            name="host"
            type="text"
            value={dsSettings.url || ''}
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="localhost:1433"
            onChange={onDSOptionChanged('url')}
          />
        </Field>
        <Field
          label={t('configuration.configuration-editor.title-database', 'Database')}
          required
          invalid={!jsonData.database}
          error={t('configuration.configuration-editor.required-database', 'Database is required')}
        >
          <Input
            width={LONG_WIDTH}
            name="database"
            value={jsonData.database || ''}
            placeholder={t('configuration.configuration-editor.placeholder-database', 'database name')}
            onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
          />
        </Field>
      </ConfigSection>

      <ConfigSection title={t('configuration.configuration-editor.title-tls-auth', 'TLS/SSL Auth')}>
        <Field
          htmlFor="encrypt"
          description={
            <>
              <Trans i18nKey="configuration.configuration-editor.description-encrypt">
                Determines whether or to which extent a secure SSL TCP/IP connection will be negotiated with the server.
              </Trans>
              <ul className={styles.ulPadding}>
                <li>
                  <Trans
                    i18nKey="configuration.configuration-editor.description-encrypt-disable"
                    values={{ encryptionValue: 'disable' }}
                  >
                    <i>{'{{encryptionValue}}'}</i> - Data sent between client and server is not encrypted.
                  </Trans>
                </li>
                <li>
                  <Trans
                    i18nKey="configuration.configuration-editor.description-encrypt-false"
                    values={{ encryptionValue: 'false' }}
                  >
                    <i>{'{{encryptionValue}}'}</i> - Data sent between client and server is not encrypted beyond the
                    login packet. (default)
                  </Trans>
                </li>
                <li>
                  <Trans
                    i18nKey="configuration.configuration-editor.description-encrypt-true"
                    values={{ encryptionValue: 'true' }}
                  >
                    <i>{'{{encryptionValue}}'}</i> - Data sent between client and server is encrypted.
                  </Trans>
                </li>
              </ul>
              <Trans i18nKey="configuration.configuration-editor.description-encrypt-older-version">
                If you&apos;re using an older version of Microsoft SQL Server like 2008 and 2008R2 you may need to
                disable encryption to be able to connect.
              </Trans>
            </>
          }
          label={t('configuration.configuration-editor.label-encrypt', 'Encrypt')}
        >
          <Select
            options={encryptOptions}
            value={jsonData.encrypt || MSSQLEncryptOptions.false}
            inputId="encrypt"
            onChange={onEncryptChanged}
            width={LONG_WIDTH}
          />
        </Field>

        {jsonData.encrypt === MSSQLEncryptOptions.true ? (
          <>
            <Field
              htmlFor="skipTlsVerify"
              label={t('configuration.configuration-editor.label-skip-tls', 'Skip TLS Verify')}
            >
              <Switch id="skipTlsVerify" onChange={onSkipTLSVerifyChanged} value={jsonData.tlsSkipVerify || false} />
            </Field>
            {jsonData.tlsSkipVerify ? null : (
              <>
                <Field
                  description={
                    <span>
                      <Trans i18nKey="configuration.configuration-editor.description-tls-cert">
                        Path to file containing the public key certificate of the CA that signed the SQL Server
                        certificate. Needed when the server certificate is self signed.
                      </Trans>
                    </span>
                  }
                  label={t('configuration.configuration-editor.label-tls-cert', 'TLS/SSL Root Certificate')}
                >
                  <Input
                    value={jsonData.sslRootCertFile || ''}
                    onChange={onUpdateDatasourceJsonDataOption(props, 'sslRootCertFile')}
                    placeholder={t(
                      'configuration.configuration-editor.placeholder-tls-cert',
                      'TLS/SSL root certificate file path'
                    )}
                    width={LONG_WIDTH}
                  />
                </Field>
                <Field
                  label={t('configuration.configuration-editor.label-common-name', 'Hostname in server certificate')}
                >
                  <Input
                    placeholder={t(
                      'configuration.configuration-editor.placeholder-common-name',
                      'Common Name (CN) in server certificate'
                    )}
                    value={jsonData.serverName || ''}
                    onChange={onUpdateDatasourceJsonDataOption(props, 'serverName')}
                    width={LONG_WIDTH}
                  />
                </Field>
              </>
            )}
          </>
        ) : null}
      </ConfigSection>

      <ConfigSection title={t('configuration.configuration-editor.title-authentication', 'Authentication')}>
        <Field
          label={t('configuration.configuration-editor.label-auth-type', 'Authentication Type')}
          htmlFor="authenticationType"
          description={
            <ul className={styles.ulPadding}>
              <li>
                <Trans i18nKey="configuration.configuration-editor.description-auth-type-sql-server">
                  <i>SQL Server Authentication</i> This is the default mechanism to connect to MS SQL Server. Enter the
                  SQL Server Authentication login or the Windows Authentication login in the DOMAIN\User format.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="configuration.configuration-editor.description-auth-type-windows-auth">
                  <i>Windows Authentication</i> Windows Integrated Security - single sign on for users who are already
                  logged onto Windows and have enabled this option for MS SQL Server.
                </Trans>
              </li>
              {azureAuthIsSupported && (
                <li>
                  <Trans i18nKey="configuration.configuration-editor.description-auth-type-azure-auth">
                    <i>Azure Authentication</i> Securely authenticate and access Azure resources and applications using
                    Azure AD credentials - Managed Service Identity and Client Secret Credentials are supported.
                  </Trans>
                </li>
              )}
              <li>
                <Trans i18nKey="configuration.configuration-editor.description-auth-type-username-password">
                  <i>Windows AD: Username + password</i> Windows Active Directory - Sign on for domain user via
                  username/password.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="configuration.configuration-editor.description-auth-type-keytab">
                  <i>Windows AD: Keytab</i> Windows Active Directory - Sign on for domain user via keytab file.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="configuration.configuration-editor.description-auth-type-credential-cache">
                  <i>Windows AD: Credential cache</i> Windows Active Directory - Sign on for domain user via credential
                  cache.
                </Trans>
              </li>
              <li>
                <Trans i18nKey="configuration.configuration-editor.description-auth-type-credential-cache-file">
                  <i>Windows AD: Credential cache file</i> Windows Active Directory - Sign on for domain user via
                  credential cache file.
                </Trans>
              </li>
            </ul>
          }
        >
          <Select
            // Default to basic authentication of none is set
            value={jsonData.authenticationType || MSSQLAuthenticationType.sqlAuth}
            inputId="authenticationType"
            options={buildAuthenticationOptions()}
            onChange={onAuthenticationMethodChanged}
            width={LONG_WIDTH}
          />
        </Field>

        <KerberosConfig {...props} />

        {/* Basic SQL auth. Render if authType === MSSQLAuthenticationType.sqlAuth OR
        authType === MSSQLAuthenticationType.kerberosRaw OR
        if no authType exists, which will be the case when creating a new data source */}
        {(jsonData.authenticationType === MSSQLAuthenticationType.sqlAuth ||
          jsonData.authenticationType === MSSQLAuthenticationType.kerberosRaw ||
          !jsonData.authenticationType) && (
          <>
            <Field
              label={t('configuration.configuration-editor.label-username', 'Username')}
              required
              invalid={!dsSettings.user}
              error={t('configuration.configuration-editor.required-username', 'Username is required')}
              description={jsonData.authenticationType === MSSQLAuthenticationType.kerberosRaw ? UsernameMessage : ''}
            >
              <Input
                value={dsSettings.user || ''}
                placeholder={
                  jsonData.authenticationType === MSSQLAuthenticationType.kerberosRaw
                    ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                      'name@EXAMPLE.COM'
                    : t('configuration.configuration-editor.placeholder-user', 'user')
                }
                onChange={onDSOptionChanged('user')}
                width={LONG_WIDTH}
              />
            </Field>
            <Field
              label={t('configuration.configuration-editor.label-password', 'Password')}
              required
              invalid={!dsSettings.secureJsonFields.password && !dsSettings.secureJsonData?.password}
              error={t('configuration.configuration-editor.required-password', 'Password is required')}
            >
              <SecretInput
                width={LONG_WIDTH}
                placeholder={t('configuration.configuration-editor.placeholder-password', 'Password')}
                isConfigured={dsSettings.secureJsonFields && dsSettings.secureJsonFields.password}
                onReset={onResetPassword}
                onChange={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
                required
              />
            </Field>
          </>
        )}

        {azureAuthIsSupported && jsonData.authenticationType === MSSQLAuthenticationType.azureAuth && (
          <FieldSet
            label={t('configuration.configuration-editor.label-auth-settings', 'Azure Authentication Settings')}
          >
            <azureAuthSettings.azureAuthSettingsUI dataSourceConfig={dsSettings} onChange={onOptionsChange} />
          </FieldSet>
        )}
      </ConfigSection>

      <Divider />
      <ConfigSection
        title={t('configuration.configuration-editor.title-additional-settings', 'Additional settings')}
        description={t(
          'configuration.configuration-editor.description-additional-settings',
          'Additional settings are optional settings that can be configured for more control over your data source. This includes connection limits, connection timeout, group-by time interval, and Secure Socks Proxy.'
        )}
        isCollapsible={true}
        isInitiallyOpen={true}
      >
        <ConnectionLimits options={dsSettings} onOptionsChange={onOptionsChange} />

        <ConfigSubSection
          title={t('configuration.configuration-editor.title-connection-details', 'Connection details')}
        >
          <Field
            description={
              <span>
                <Trans
                  i18nKey="configuration.configuration-editor.description-min-interval"
                  values={{ exampleInterval: '1m' }}
                >
                  A lower limit for the auto group by time interval. Recommended to be set to write frequency, for
                  example
                  <code>{'{{exampleInterval}}'}</code> if your data is written every minute.
                </Trans>
              </span>
            }
            label={t('configuration.configuration-editor.label-min-interval', 'Min time interval')}
          >
            <Input
              width={LONG_WIDTH}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="1m"
              value={jsonData.timeInterval || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
            />
          </Field>
          <Field
            description={
              <span>
                <Trans
                  i18nKey="configuration.configuration-editor.description-connection-timeout"
                  values={{ defaultTimeout: '0' }}
                >
                  The number of seconds to wait before canceling the request when connecting to the database. The
                  default is <code>{'{{defaultTimeout}}'}</code>, meaning no timeout.
                </Trans>
              </span>
            }
            label={t('configuration.configuration-editor.label-connection-timeout', 'Connection timeout')}
          >
            <NumberInput
              width={LONG_WIDTH}
              defaultValue={60}
              value={jsonData.connectionTimeout || 0}
              onChange={onConnectionTimeoutChanged}
            />
          </Field>
        </ConfigSubSection>
        {config.secureSocksDSProxyEnabled && (
          <SecureSocksProxySettings options={dsSettings} onOptionsChange={onOptionsChange} />
        )}
        <KerberosAdvancedSettings {...props} />
      </ConfigSection>
    </>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    ulPadding: css({
      margin: theme.spacing(1, 0),
      paddingLeft: theme.spacing(5),
    }),
  };
}
