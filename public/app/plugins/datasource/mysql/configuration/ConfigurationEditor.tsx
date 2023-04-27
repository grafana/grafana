import React, { SyntheticEvent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
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
  SecureSocksProxySettings,
} from '@grafana/ui';
import { config } from 'app/core/config';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { TLSSecretsConfig } from 'app/features/plugins/sql/components/configuration/TLSSecretsConfig';
import { useMigrateDatabaseFields } from 'app/features/plugins/sql/components/configuration/useMigrateDatabaseFields';

import { MySQLOptions } from '../types';

export const ConfigurationEditor = (props: DataSourcePluginOptionsEditorProps<MySQLOptions>) => {
  const { options, onOptionsChange } = props;
  const jsonData = options.jsonData;

  useMigrateDatabaseFields(props);

  const onResetPassword = () => {
    updateDatasourcePluginResetOption(props, 'password');
  };

  const onDSOptionChanged = (property: keyof MySQLOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      onOptionsChange({ ...options, ...{ [property]: event.currentTarget.value } });
    };
  };

  const onSwitchChanged = (property: keyof MySQLOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      updateDatasourcePluginJsonDataOption(props, property, event.currentTarget.checked);
    };
  };

  const WIDTH_SHORT = 15;
  const WIDTH_MEDIUM = 22;
  const WIDTH_LONG = 40;

  return (
    <>
      <FieldSet label="MySQL Connection" width={400}>
        <InlineField labelWidth={WIDTH_SHORT} label="Host">
          <Input
            width={WIDTH_LONG}
            name="host"
            type="text"
            value={options.url || ''}
            placeholder="localhost:3306"
            onChange={onDSOptionChanged('url')}
          ></Input>
        </InlineField>
        <InlineField labelWidth={WIDTH_SHORT} label="Database">
          <Input
            width={WIDTH_LONG}
            name="database"
            value={jsonData.database || ''}
            placeholder="database name"
            onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
          ></Input>
        </InlineField>
        <InlineFieldRow>
          <InlineField labelWidth={WIDTH_SHORT} label="User">
            <Input
              width={WIDTH_SHORT}
              value={options.user || ''}
              placeholder="user"
              onChange={onDSOptionChanged('user')}
            ></Input>
          </InlineField>
          <InlineField labelWidth={WIDTH_SHORT - 5} label="Password">
            <SecretInput
              width={WIDTH_SHORT}
              placeholder="Password"
              isConfigured={options.secureJsonFields && options.secureJsonFields.password}
              onReset={onResetPassword}
              onBlur={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
            ></SecretInput>
          </InlineField>
        </InlineFieldRow>
        <InlineField
          tooltip={
            <span>
              Specify the time zone used in the database session, e.g. <code>Europe/Berlin</code> or
              <code>+02:00</code>. This is necessary, if the timezone of the database (or the host of the database) is
              set to something other than UTC. The value is set in the session with
              <code>SET time_zone=&apos;...&apos;</code>. If you leave this field empty, the timezone is not updated.
              You can find more information in the MySQL documentation.
            </span>
          }
          label="Session timezone"
          labelWidth={WIDTH_MEDIUM}
        >
          <Input
            width={WIDTH_LONG - 5}
            value={jsonData.timezone || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timezone')}
            placeholder="(default)"
          ></Input>
        </InlineField>
        <InlineFieldRow>
          <InlineField
            labelWidth={WIDTH_MEDIUM}
            tooltip="Enables TLS authentication using client cert configured in secure json data."
            htmlFor="tlsAuth"
            label="Use TLS Client Auth"
          >
            <InlineSwitch
              id="tlsAuth"
              onChange={onSwitchChanged('tlsAuth')}
              value={jsonData.tlsAuth || false}
            ></InlineSwitch>
          </InlineField>
          <InlineField
            labelWidth={WIDTH_MEDIUM}
            tooltip="Needed for verifing self-signed TLS Certs."
            htmlFor="tlsCaCert"
            label="With CA Cert"
          >
            <InlineSwitch
              id="tlsCaCert"
              onChange={onSwitchChanged('tlsAuthWithCACert')}
              value={jsonData.tlsAuthWithCACert || false}
            ></InlineSwitch>
          </InlineField>
        </InlineFieldRow>
        <InlineField
          labelWidth={WIDTH_MEDIUM}
          tooltip="When enabled, skips verification of the MySql server's TLS certificate chain and host name."
          htmlFor="skipTLSVerify"
          label="Skip TLS Verification"
        >
          <InlineSwitch
            id="skipTLSVerify"
            onChange={onSwitchChanged('tlsSkipVerify')}
            value={jsonData.tlsSkipVerify || false}
          ></InlineSwitch>
        </InlineField>
      </FieldSet>

      {config.secureSocksDSProxyEnabled && (
        <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
      )}
      {jsonData.tlsAuth || jsonData.tlsAuthWithCACert ? (
        <FieldSet label="TLS/SSL Auth Details">
          <TLSSecretsConfig
            showCACert={jsonData.tlsAuthWithCACert}
            showKeyPair={jsonData.tlsAuth}
            editorProps={props}
            labelWidth={25}
          ></TLSSecretsConfig>
        </FieldSet>
      ) : null}

      <ConnectionLimits labelWidth={WIDTH_SHORT} options={options} onOptionsChange={onOptionsChange} />

      <FieldSet label="MySQL details">
        <InlineField
          tooltip={
            <span>
              A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example
              <code>1m</code> if your data is written every minute.
            </span>
          }
          labelWidth={WIDTH_MEDIUM}
          label="Min time interval"
        >
          <Input
            placeholder="1m"
            value={jsonData.timeInterval || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
          ></Input>
        </InlineField>
      </FieldSet>

      <Alert title="User Permission" severity="info">
        The database user should only be granted SELECT permissions on the specified database &amp; tables you want to
        query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
        statements like <code>USE otherdb;</code> and <code>DROP TABLE user;</code> would be executed. To protect
        against this we <strong>Highly</strong> recommend you create a specific MySQL user with restricted permissions.
        Check out the{' '}
        <Link rel="noreferrer" target="_blank" href="http://docs.grafana.org/features/datasources/mysql/">
          MySQL Data Source Docs
        </Link>{' '}
        for more information.
      </Alert>
    </>
  );
};
