import React, { SyntheticEvent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { Alert, FieldSet, InlineField, InlineFieldRow, InlineSwitch, Input, Link, SecretInput } from '@grafana/ui';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { TLSSecretsConfig } from 'app/features/plugins/sql/components/configuration/TLSSecretsConfig';

import { MySQLOptions } from '../types';

export const ConfigurationEditor = (props: DataSourcePluginOptionsEditorProps<MySQLOptions>) => {
  const { options, onOptionsChange } = props;
  const jsonData = options.jsonData;

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

  const mediumWidth = 20;
  const shortWidth = 15;
  const longWidth = 40;

  return (
    <>
      <FieldSet label="MySQL Connection" width={400}>
        <InlineField labelWidth={shortWidth} label="Host">
          <Input
            width={longWidth}
            name="host"
            type="text"
            value={options.url || ''}
            placeholder="localhost:3306"
            onChange={onDSOptionChanged('url')}
          ></Input>
        </InlineField>
        <InlineField labelWidth={shortWidth} label="Database">
          <Input
            width={longWidth}
            name="database"
            value={options.database || ''}
            placeholder="database name"
            onChange={onDSOptionChanged('database')}
          ></Input>
        </InlineField>
        <InlineFieldRow>
          <InlineField labelWidth={shortWidth} label="User">
            <Input
              width={shortWidth}
              value={options.user || ''}
              placeholder="user"
              onChange={onDSOptionChanged('user')}
            ></Input>
          </InlineField>
          <InlineField labelWidth={shortWidth - 5} label="Password">
            <SecretInput
              width={shortWidth}
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
          labelWidth={mediumWidth}
        >
          <Input
            width={longWidth - 5}
            value={jsonData.timezone || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timezone')}
            placeholder="(default)"
          ></Input>
        </InlineField>
        <InlineFieldRow>
          <InlineField labelWidth={mediumWidth} htmlFor="tlsAuth" label="TLS Client Auth">
            <InlineSwitch
              id="tlsAuth"
              onChange={onSwitchChanged('tlsAuth')}
              value={jsonData.tlsAuth || false}
            ></InlineSwitch>
          </InlineField>
          <InlineField
            labelWidth={mediumWidth}
            tooltip="Needed for verifing self-signed TLS Certs"
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
        <InlineField labelWidth={mediumWidth} htmlFor="skipTLSVerify" label="Skip TLS Verify">
          <InlineSwitch
            id="skipTLSVerify"
            onChange={onSwitchChanged('tlsSkipVerify')}
            value={jsonData.tlsSkipVerify || false}
          ></InlineSwitch>
        </InlineField>
      </FieldSet>

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

      <ConnectionLimits
        labelWidth={shortWidth}
        jsonData={jsonData}
        onPropertyChanged={(property, value) => {
          updateDatasourcePluginJsonDataOption(props, property, value);
        }}
      ></ConnectionLimits>

      <FieldSet label="MySQL details">
        <InlineField
          tooltip={
            <span>
              A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example
              <code>1m</code> if your data is written every minute.
            </span>
          }
          labelWidth={mediumWidth}
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
