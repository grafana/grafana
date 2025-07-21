import { SyntheticEvent, useState } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { ConfigSection, ConfigSubSection, DataSourceDescription, EditorStack } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { ConnectionLimits, Divider, TLSSecretsConfig, useMigrateDatabaseFields } from '@grafana/sql';
import {
  Input,
  Select,
  SecretInput,
  Field,
  Tooltip,
  Label,
  Icon,
  Switch,
  SecureSocksProxySettings,
  Collapse,
} from '@grafana/ui';

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
  const [isOpen, setIsOpen] = useState(true);

  useAutoDetectFeatures({ props, setVersionOptions });
  useMigrateDatabaseFields(props);

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

  const WIDTH_LONG = 40;

  return (
    <>
      <DataSourceDescription
        dataSourceName="Postgres"
        docsLink="https://grafana.com/docs/grafana/latest/datasources/postgres/"
        hasRequiredFields={true}
      />

      <Divider />

      <Collapse collapsible label="User Permissions" isOpen={isOpen} onToggle={() => setIsOpen((x) => !x)}>
        The database user should only be granted SELECT permissions on the specified database &amp; tables you want to
        query. <br />
        Grafana does not validate that queries are safe so queries can contain any SQL statement. For example,
        statements like <code>DELETE FROM user;</code> and <code>DROP TABLE user;</code> would be executed. <br />
        To protect against this we <strong>Highly</strong> recommend you create a specific PostgreSQL user with
        restricted permissions. Check out the docs for more information.
      </Collapse>

      <Divider />

      <ConfigSection title="Connection">
        <Field label="Host URL" required>
          <Input
            width={WIDTH_LONG}
            name="host"
            type="text"
            value={options.url || ''}
            placeholder="localhost:5432"
            onChange={onDSOptionChanged('url')}
          />
        </Field>

        <Field label="Database name" required>
          <Input
            width={WIDTH_LONG}
            name="database"
            value={jsonData.database || ''}
            placeholder="Database"
            onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
          />
        </Field>
      </ConfigSection>

      <Divider />

      <ConfigSection title="Authentication">
        <Field label="Username" required>
          <Input
            width={WIDTH_LONG}
            value={options.user || ''}
            placeholder="Username"
            onChange={onDSOptionChanged('user')}
          />
        </Field>

        <Field label="Password" required>
          <SecretInput
            width={WIDTH_LONG}
            placeholder="Password"
            isConfigured={options.secureJsonFields && options.secureJsonFields.password}
            onReset={onResetPassword}
            onBlur={onUpdateDatasourceSecureJsonDataOption(props, 'password')}
          />
        </Field>
      </ConfigSection>

      <Divider />

      <ConfigSection title="TLS/SSL Auth Details" isCollapsible>
        <Field
          label={
            <Label>
              <EditorStack gap={0.5}>
                <span>TLS/SSL Mode</span>
                <Tooltip
                  content={
                    <span>
                      This option determines whether or with what priority a secure TLS/SSL TCP/IP connection will be
                      negotiated with the server
                    </span>
                  }
                >
                  <Icon name="info-circle" size="sm" />
                </Tooltip>
              </EditorStack>
            </Label>
          }
        >
          <Select
            options={tlsModes}
            value={jsonData.sslmode || PostgresTLSModes.require}
            onChange={onJSONDataOptionSelected('sslmode')}
            width={WIDTH_LONG}
          />
        </Field>
        {options.jsonData.sslmode !== PostgresTLSModes.disable ? (
          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>TLS/SSL Method</span>
                  <Tooltip
                    content={
                      <span>
                        This option determines how TLS/SSL certifications are configured. Selecting{' '}
                        <i>File system path</i> will allow you to configure certificates by specifying paths to existing
                        certificates on the local file system where Grafana is running. Be sure that the file is
                        readable by the user executing the Grafana process.
                        <br />
                        <br />
                        Selecting <i>Certificate content</i> will allow you to configure certificates by specifying its
                        content. The content will be stored encrypted in Grafana&apos;s database. When connecting to the
                        database the certificates will be written as files to Grafana&apos;s configured data path on the
                        local file system.
                      </span>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
              </Label>
            }
          >
            <Select
              options={tlsMethods}
              value={jsonData.tlsConfigurationMethod || PostgresTLSMethods.filePath}
              onChange={onJSONDataOptionSelected('tlsConfigurationMethod')}
              width={WIDTH_LONG}
            />
          </Field>
        ) : null}
        {jsonData.sslmode !== PostgresTLSModes.disable ? (
          <>
            {jsonData.tlsConfigurationMethod === PostgresTLSMethods.fileContent ? (
              <TLSSecretsConfig
                showCACert={
                  jsonData.sslmode === PostgresTLSModes.verifyCA || jsonData.sslmode === PostgresTLSModes.verifyFull
                }
                editorProps={props}
                labelWidth={WIDTH_LONG}
              />
            ) : (
              <>
                <Field
                  label={
                    <Label>
                      <EditorStack gap={0.5}>
                        <span>TLS/SSL Root Certificate</span>
                        <Tooltip
                          content={
                            <span>
                              If the selected TLS/SSL mode requires a server root certificate, provide the path to the
                              file here.
                            </span>
                          }
                        >
                          <Icon name="info-circle" size="sm" />
                        </Tooltip>
                      </EditorStack>
                    </Label>
                  }
                >
                  <Input
                    value={jsonData.sslRootCertFile || ''}
                    onChange={onUpdateDatasourceJsonDataOption(props, 'sslRootCertFile')}
                    placeholder="TLS/SSL root cert file"
                    width={WIDTH_LONG}
                  />
                </Field>
                <Field
                  label={
                    <Label>
                      <EditorStack gap={0.5}>
                        <span>TLS/SSL Client Certificate</span>
                        <Tooltip
                          content={
                            <span>
                              To authenticate with an TLS/SSL client certificate, provide the path to the file here. Be
                              sure that the file is readable by the user executing the grafana process.
                            </span>
                          }
                        >
                          <Icon name="info-circle" size="sm" />
                        </Tooltip>
                      </EditorStack>
                    </Label>
                  }
                >
                  <Input
                    value={jsonData.sslCertFile || ''}
                    onChange={onUpdateDatasourceJsonDataOption(props, 'sslCertFile')}
                    placeholder="TLS/SSL client cert file"
                    width={WIDTH_LONG}
                  />
                </Field>
                <Field
                  label={
                    <Label>
                      <EditorStack gap={0.5}>
                        <span>TLS/SSL Client Key</span>
                        <Tooltip
                          content={
                            <span>
                              To authenticate with a client TLS/SSL certificate, provide the path to the corresponding
                              key file here. Be sure that the file is <i>only</i> readable by the user executing the
                              grafana process.
                            </span>
                          }
                        >
                          <Icon name="info-circle" size="sm" />
                        </Tooltip>
                      </EditorStack>
                    </Label>
                  }
                >
                  <Input
                    value={jsonData.sslKeyFile || ''}
                    onChange={onUpdateDatasourceJsonDataOption(props, 'sslKeyFile')}
                    placeholder="TLS/SSL client key file"
                    width={WIDTH_LONG}
                  />
                </Field>
              </>
            )}
          </>
        ) : null}
      </ConfigSection>

      <Divider />

      <ConfigSection title="Additional settings" isCollapsible>
        <ConfigSubSection title="PostgreSQL Options">
          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>Version</span>
                  <Tooltip
                    content={
                      <span>This option controls what functions are available in the PostgreSQL query builder</span>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
              </Label>
            }
          >
            <Select
              value={jsonData.postgresVersion || 903}
              onChange={onJSONDataOptionSelected('postgresVersion')}
              options={versionOptions}
              width={WIDTH_LONG}
            />
          </Field>
          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>Min time interval</span>
                  <Tooltip
                    content={
                      <span>
                        A lower limit for the auto group by time interval. Recommended to be set to write frequency, for
                        example
                        <code>1m</code> if your data is written every minute.
                      </span>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
              </Label>
            }
          >
            <Input
              placeholder="1m"
              value={jsonData.timeInterval || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
              width={WIDTH_LONG}
            />
          </Field>
          <Field
            label={
              <Label>
                <EditorStack gap={0.5}>
                  <span>TimescaleDB</span>
                  <Tooltip
                    content={
                      <span>
                        TimescaleDB is a time-series database built as a PostgreSQL extension. If enabled, Grafana will
                        use
                        <code>time_bucket</code> in the <code>$__timeGroup</code> macro and display TimescaleDB specific
                        aggregate functions in the query builder.
                      </span>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </EditorStack>
              </Label>
            }
          >
            <Switch value={jsonData.timescaledb || false} onChange={onTimeScaleDBChanged} width={WIDTH_LONG} />
          </Field>
        </ConfigSubSection>

        <ConnectionLimits options={options} onOptionsChange={onOptionsChange} />

        {config.secureSocksDSProxyEnabled && (
          <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
        )}
      </ConfigSection>
    </>
  );
};
