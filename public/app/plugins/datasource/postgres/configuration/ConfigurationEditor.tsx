import React, { SyntheticEvent, useState } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import {
  Alert,
  InlineSwitch,
  FieldSet,
  InlineField,
  InlineFieldRow,
  Input,
  Select,
  SecretInput,
  Link,
} from '@grafana/ui';
import { config } from 'app/core/config';
import { ConnectionLimits } from 'app/features/plugins/sql/components/configuration/ConnectionLimits';
import { TLSSecretsConfig } from 'app/features/plugins/sql/components/configuration/TLSSecretsConfig';
import { useMigrateDatabaseField } from 'app/features/plugins/sql/components/configuration/useMigrateDatabaseField';

import { PostgresOptions, PostgresTLSMethods, PostgresTLSModes, SecureJsonData } from '../types';

import { useAutoDetectFeatures } from './useAutoDetectFeatures';

export const postgresVersions: Array<SelectableValue<number>> = [
  { label: '9.0', value: 900 },
  { label: '9.1', value: 901 },
  { label: '9.2', value: 902 },
  { label: '9.3', value: 903 },
  { label: '9.4', value: 904 },
  { label: '9.5', value: 905 },
  { label: '9.6', value: 906 },
  { label: '10', value: 1000 },
  { label: '11', value: 1100 },
  { label: '12', value: 1200 },
  { label: '13', value: 1300 },
  { label: '14', value: 1400 },
  { label: '15', value: 1500 },
];

export const PostgresConfigEditor = (props: DataSourcePluginOptionsEditorProps<PostgresOptions, SecureJsonData>) => {
  const [versionOptions, setVersionOptions] = useState(postgresVersions);

  useAutoDetectFeatures({ props, setVersionOptions });

  useMigrateDatabaseField(props);

  const { options, onOptionsChange } = props;
  const jsonData = options.jsonData;

  const onResetPassword = () => {
    updateDatasourcePluginResetOption(props, 'password');
  };

  const tlsModes: Array<SelectableValue<PostgresTLSModes>> = [
    { value: PostgresTLSModes.disable, label: 'disable' },
    { value: PostgresTLSModes.require, label: 'require' },
    { value: PostgresTLSModes.verifyCA, label: 'verify-ca' },
    { value: PostgresTLSModes.verifyFull, label: 'verify-full' },
  ];

  const tlsMethods: Array<SelectableValue<PostgresTLSMethods>> = [
    { value: PostgresTLSMethods.filePath, label: 'File system path' },
    { value: PostgresTLSMethods.fileContent, label: 'Certificate content' },
  ];

  const onJSONDataOptionSelected = (property: keyof PostgresOptions) => {
    return (value: SelectableValue) => {
      updateDatasourcePluginJsonDataOption(props, property, value.value);
    };
  };

  const onTimeScaleDBChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'timescaledb', event.currentTarget.checked);
  };

  const onDSOptionChanged = (property: keyof PostgresOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      onOptionsChange({ ...options, ...{ [property]: event.currentTarget.value } });
    };
  };

  const labelWidthSSLDetails = 25;
  const labelWidthConnection = 20;
  const labelWidthShort = 20;

  return (
    <>
      <FieldSet label="PostgreSQL Connection" width={400}>
        <InlineField labelWidth={labelWidthConnection} label="Host">
          <Input
            width={40}
            name="host"
            type="text"
            value={options.url || ''}
            placeholder="localhost:5432"
            onChange={onDSOptionChanged('url')}
          ></Input>
        </InlineField>
        <InlineField labelWidth={labelWidthConnection} label="Database">
          <Input
            width={40}
            name="database"
            value={jsonData.database || ''}
            placeholder="database name"
            onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
          ></Input>
        </InlineField>
        <InlineFieldRow>
          <InlineField labelWidth={labelWidthConnection} label="User">
            <Input value={options.user || ''} placeholder="user" onChange={onDSOptionChanged('user')}></Input>
          </InlineField>
          <InlineField label="Password">
            <SecretInput
              placeholder="Password"
              isConfigured={options.secureJsonFields?.password}
              onReset={onResetPassword}
              onBlur={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
            ></SecretInput>
          </InlineField>
        </InlineFieldRow>
        <InlineField
          labelWidth={labelWidthConnection}
          label="TLS/SSL Mode"
          htmlFor="tlsMode"
          tooltip="This option determines whether or with what priority a secure TLS/SSL TCP/IP connection will be negotiated with the server."
        >
          <Select
            options={tlsModes}
            inputId="tlsMode"
            value={jsonData.sslmode || PostgresTLSModes.verifyFull}
            onChange={onJSONDataOptionSelected('sslmode')}
          ></Select>
        </InlineField>
        {options.jsonData.sslmode !== PostgresTLSModes.disable ? (
          <InlineField
            labelWidth={labelWidthConnection}
            label="TLS/SSL Method"
            htmlFor="tlsMethod"
            tooltip={
              <span>
                This option determines how TLS/SSL certifications are configured. Selecting <i>File system path</i> will
                allow you to configure certificates by specifying paths to existing certificates on the local file
                system where Grafana is running. Be sure that the file is readable by the user executing the Grafana
                process.
                <br />
                <br />
                Selecting <i>Certificate content</i> will allow you to configure certificates by specifying its content.
                The content will be stored encrypted in Grafana&apos;s database. When connecting to the database the
                certificates will be written as files to Grafana&apos;s configured data path on the local file system.
              </span>
            }
          >
            <Select
              options={tlsMethods}
              inputId="tlsMethod"
              value={jsonData.tlsConfigurationMethod || PostgresTLSMethods.filePath}
              onChange={onJSONDataOptionSelected('tlsConfigurationMethod')}
            ></Select>
          </InlineField>
        ) : null}
      </FieldSet>

      {config.secureSocksDSProxyEnabled && (
        <FieldSet label="Secure Socks Proxy">
          <InlineField labelWidth={26} label="Enabled" tooltip="Connect to this datasource via the secure socks proxy.">
            <InlineSwitch
              value={options.jsonData.enableSecureSocksProxy ?? false}
              onChange={(event) =>
                onOptionsChange({
                  ...options,
                  jsonData: { ...options.jsonData, enableSecureSocksProxy: event!.currentTarget.checked },
                })
              }
            />
          </InlineField>
        </FieldSet>
      )}
      {jsonData.sslmode !== PostgresTLSModes.disable ? (
        <FieldSet label="TLS/SSL Auth Details">
          {jsonData.tlsConfigurationMethod === PostgresTLSMethods.fileContent ? (
            <TLSSecretsConfig
              showCACert={
                jsonData.sslmode === PostgresTLSModes.verifyCA || jsonData.sslmode === PostgresTLSModes.verifyFull
              }
              editorProps={props}
              labelWidth={labelWidthSSLDetails}
            ></TLSSecretsConfig>
          ) : (
            <>
              <InlineField
                tooltip={
                  <span>
                    If the selected TLS/SSL mode requires a server root certificate, provide the path to the file here.
                  </span>
                }
                labelWidth={labelWidthSSLDetails}
                label="TLS/SSL Root Certificate"
              >
                <Input
                  value={jsonData.sslRootCertFile || ''}
                  onChange={onUpdateDatasourceJsonDataOption(props, 'sslRootCertFile')}
                  placeholder="TLS/SSL root cert file"
                ></Input>
              </InlineField>
              <InlineField
                tooltip={
                  <span>
                    To authenticate with an TLS/SSL client certificate, provide the path to the file here. Be sure that
                    the file is readable by the user executing the grafana process.
                  </span>
                }
                labelWidth={labelWidthSSLDetails}
                label="TLS/SSL Client Certificate"
              >
                <Input
                  value={jsonData.sslCertFile || ''}
                  onChange={onUpdateDatasourceJsonDataOption(props, 'sslCertFile')}
                  placeholder="TLS/SSL client cert file"
                ></Input>
              </InlineField>
              <InlineField
                tooltip={
                  <span>
                    To authenticate with a client TLS/SSL certificate, provide the path to the corresponding key file
                    here. Be sure that the file is <i>only</i> readable by the user executing the grafana process.
                  </span>
                }
                labelWidth={labelWidthSSLDetails}
                label="TLS/SSL Client Key"
              >
                <Input
                  value={jsonData.sslKeyFile || ''}
                  onChange={onUpdateDatasourceJsonDataOption(props, 'sslKeyFile')}
                  placeholder="TLS/SSL client key file"
                ></Input>
              </InlineField>
            </>
          )}
        </FieldSet>
      ) : null}

      <ConnectionLimits
        labelWidth={labelWidthShort}
        jsonData={jsonData}
        onPropertyChanged={(property, value) => {
          updateDatasourcePluginJsonDataOption(props, property, value);
        }}
      ></ConnectionLimits>

      <FieldSet label="PostgreSQL details">
        <InlineField
          tooltip="This option controls what functions are available in the PostgreSQL query builder"
          labelWidth={labelWidthShort}
          htmlFor="postgresVersion"
          label="Version"
        >
          <Select
            value={jsonData.postgresVersion || 903}
            inputId="postgresVersion"
            onChange={onJSONDataOptionSelected('postgresVersion')}
            options={versionOptions}
          ></Select>
        </InlineField>
        <InlineField
          tooltip={
            <span>
              TimescaleDB is a time-series database built as a PostgreSQL extension. If enabled, Grafana will use
              <code>time_bucket</code> in the <code>$__timeGroup</code> macro and display TimescaleDB specific aggregate
              functions in the query builder.
            </span>
          }
          labelWidth={labelWidthShort}
          label="TimescaleDB"
          htmlFor="timescaledb"
        >
          <InlineSwitch
            id="timescaledb"
            value={jsonData.timescaledb || false}
            onChange={onTimeScaleDBChanged}
          ></InlineSwitch>
        </InlineField>
        <InlineField
          tooltip={
            <span>
              A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example
              <code>1m</code> if your data is written every minute.
            </span>
          }
          labelWidth={labelWidthShort}
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
        statements like <code>DELETE FROM user;</code> and <code>DROP TABLE user;</code> would be executed. To protect
        against this we <strong>Highly</strong> recommend you create a specific PostgreSQL user with restricted
        permissions. Check out the{' '}
        <Link rel="noreferrer" target="_blank" href="http://docs.grafana.org/features/datasources/postgres/">
          PostgreSQL Data Source Docs
        </Link>{' '}
        for more information.
      </Alert>
    </>
  );
};
