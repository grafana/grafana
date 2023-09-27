import { css } from '@emotion/css';
import React, { SyntheticEvent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  GrafanaTheme2,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import {
  Alert,
  FieldSet,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  Input,
  Link,
  SecretInput,
  Select,
  useStyles2,
  SecureSocksProxySettings,
} from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { config } from 'app/core/config';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { useMigrateDatabaseFields } from 'app/features/plugins/sql/components/configuration/useMigrateDatabaseFields';

import { MSSQLAuthenticationType, MSSQLEncryptOptions, MssqlOptions } from '../types';

export const ConfigurationEditor = (props: DataSourcePluginOptionsEditorProps<MssqlOptions>) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getStyles);
  const jsonData = options.jsonData;

  useMigrateDatabaseFields(props);

  const onResetPassword = () => {
    updateDatasourcePluginResetOption(props, 'password');
  };

  const onDSOptionChanged = (property: keyof MssqlOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      onOptionsChange({ ...options, ...{ [property]: event.currentTarget.value } });
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
      ...options,
      ...{
        jsonData: { ...jsonData, ...{ authenticationType: value.value } },
        secureJsonData: { ...options.secureJsonData, ...{ password: '' } },
        secureJsonFields: { ...options.secureJsonFields, ...{ password: false } },
        user: '',
      },
    });
  };

  const onConnectionTimeoutChanged = (connectionTimeout?: number) => {
    updateDatasourcePluginJsonDataOption(props, 'connectionTimeout', connectionTimeout ?? 0);
  };

  const authenticationOptions: Array<SelectableValue<MSSQLAuthenticationType>> = [
    { value: MSSQLAuthenticationType.sqlAuth, label: 'SQL Server Authentication' },
    { value: MSSQLAuthenticationType.windowsAuth, label: 'Windows Authentication' },
  ];

  const encryptOptions: Array<SelectableValue<string>> = [
    { value: MSSQLEncryptOptions.disable, label: 'disable' },
    { value: MSSQLEncryptOptions.false, label: 'false' },
    { value: MSSQLEncryptOptions.true, label: 'true' },
  ];

  const shortWidth = 15;
  const longWidth = 46;
  const labelWidthSSL = 25;
  const labelWidthDetails = 20;

  return (
    <>
      <FieldSet label="MS SQL Connection" width={400}>
        <InlineField labelWidth={shortWidth} label="Host">
          <Input
            width={longWidth}
            name="host"
            type="text"
            value={options.url || ''}
            placeholder="localhost:1433"
            onChange={onDSOptionChanged('url')}
          ></Input>
        </InlineField>
        <InlineField labelWidth={shortWidth} label="Database">
          <Input
            width={longWidth}
            name="database"
            value={jsonData.database || ''}
            placeholder="database name"
            onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
          ></Input>
        </InlineField>
        <InlineField
          label="Authentication"
          labelWidth={shortWidth}
          htmlFor="authenticationType"
          tooltip={
            <ul className={styles.ulPadding}>
              <li>
                <i>SQL Server Authentication</i> This is the default mechanism to connect to MS SQL Server. Enter the
                SQL Server Authentication login or the Windows Authentication login in the DOMAIN\User format.
              </li>
              <li>
                <i>Windows Authentication</i> Windows Integrated Security - single sign on for users who are already
                logged onto Windows and have enabled this option for MS SQL Server.
              </li>
            </ul>
          }
        >
          <Select
            value={jsonData.authenticationType || MSSQLAuthenticationType.sqlAuth}
            inputId="authenticationType"
            options={authenticationOptions}
            onChange={onAuthenticationMethodChanged}
          ></Select>
        </InlineField>
        {jsonData.authenticationType === MSSQLAuthenticationType.windowsAuth ? null : (
          <InlineFieldRow>
            <InlineField labelWidth={shortWidth} label="User">
              <Input
                width={shortWidth}
                value={options.user || ''}
                placeholder="user"
                onChange={onDSOptionChanged('user')}
              ></Input>
            </InlineField>
            <InlineField label="Password" labelWidth={shortWidth}>
              <SecretInput
                width={shortWidth}
                placeholder="Password"
                isConfigured={options.secureJsonFields && options.secureJsonFields.password}
                onReset={onResetPassword}
                onBlur={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
              ></SecretInput>
            </InlineField>
          </InlineFieldRow>
        )}
      </FieldSet>

      {config.secureSocksDSProxyEnabled && (
        <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
      )}

      <FieldSet label="TLS/SSL Auth">
        <InlineField
          labelWidth={labelWidthSSL}
          htmlFor="encrypt"
          tooltip={
            <>
              Determines whether or to which extent a secure SSL TCP/IP connection will be negotiated with the server.
              <ul className={styles.ulPadding}>
                <li>
                  <i>disable</i> - Data sent between client and server is not encrypted.
                </li>
                <li>
                  <i>false</i> - Data sent between client and server is not encrypted beyond the login packet. (default)
                </li>
                <li>
                  <i>true</i> - Data sent between client and server is encrypted.
                </li>
              </ul>
              If you&apos;re using an older version of Microsoft SQL Server like 2008 and 2008R2 you may need to disable
              encryption to be able to connect.
            </>
          }
          label="Encrypt"
        >
          <Select
            options={encryptOptions}
            value={jsonData.encrypt || MSSQLEncryptOptions.false}
            inputId="encrypt"
            onChange={onEncryptChanged}
          ></Select>
        </InlineField>

        {jsonData.encrypt === MSSQLEncryptOptions.true ? (
          <>
            <InlineField labelWidth={labelWidthSSL} htmlFor="skipTlsVerify" label="Skip TLS Verify">
              <InlineSwitch
                id="skipTlsVerify"
                onChange={onSkipTLSVerifyChanged}
                value={jsonData.tlsSkipVerify || false}
              ></InlineSwitch>
            </InlineField>
            {jsonData.tlsSkipVerify ? null : (
              <>
                <InlineField
                  labelWidth={labelWidthSSL}
                  tooltip={
                    <span>
                      Path to file containing the public key certificate of the CA that signed the SQL Server
                      certificate. Needed when the server certificate is self signed.
                    </span>
                  }
                  label="TLS/SSL Root Certificate"
                >
                  <Input
                    value={jsonData.sslRootCertFile || ''}
                    onChange={onUpdateDatasourceJsonDataOption(props, 'sslRootCertFile')}
                    placeholder="TLS/SSL root certificate file path"
                  ></Input>
                </InlineField>
                <InlineField labelWidth={labelWidthSSL} label="Hostname in server certificate">
                  <Input
                    placeholder="Common Name (CN) in server certificate"
                    value={jsonData.serverName || ''}
                    onChange={onUpdateDatasourceJsonDataOption(props, 'serverName')}
                  ></Input>
                </InlineField>
              </>
            )}
          </>
        ) : null}
      </FieldSet>

      <ConnectionLimits labelWidth={shortWidth} options={options} onOptionsChange={onOptionsChange} />

      <FieldSet label="MS SQL details">
        <InlineField
          tooltip={
            <span>
              A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example
              <code>1m</code> if your data is written every minute.
            </span>
          }
          label="Min time interval"
          labelWidth={labelWidthDetails}
        >
          <Input
            placeholder="1m"
            value={jsonData.timeInterval || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
          ></Input>
        </InlineField>
        <InlineField
          tooltip={
            <span>
              The number of seconds to wait before canceling the request when connecting to the database. The default is{' '}
              <code>0</code>, meaning no timeout.
            </span>
          }
          label="Connection timeout"
          labelWidth={labelWidthDetails}
        >
          <NumberInput
            placeholder="60"
            min={0}
            value={jsonData.connectionTimeout}
            onChange={onConnectionTimeoutChanged}
          ></NumberInput>
        </InlineField>
      </FieldSet>

      <Alert title="User Permission" severity="info">
        The database user should only be granted SELECT permissions on the specified database and tables you want to
        query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
        statements like <code>USE otherdb;</code> and <code>DROP TABLE user;</code> would be executed. To protect
        against this we <em>highly</em> recommend you create a specific MS SQL user with restricted permissions. Check
        out the{' '}
        <Link rel="noreferrer" target="_blank" href="http://docs.grafana.org/features/datasources/mssql/">
          Microsoft SQL Server Data Source Docs
        </Link>{' '}
        for more information.
      </Alert>
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
