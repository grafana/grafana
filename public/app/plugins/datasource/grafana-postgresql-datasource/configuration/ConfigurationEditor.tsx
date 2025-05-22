import { SyntheticEvent } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { EditorStack } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { ConnectionLimits, TLSSecretsConfig, useMigrateDatabaseFields } from '@grafana/sql';
import {
  Alert,
  Space,
  InlineField,
  LinkButton,
  Input,
  Select,
  SecretInput,
  Field,
  Tooltip,
  Label,
  Icon,
  Switch,
  SecureSocksProxySettings,
  Box,
  CollapsableSection,
  Text,
  Stack,
  PopoverContent,
  IconName,
} from '@grafana/ui';

import { PostgresOptions, PostgresTLSMethods, PostgresTLSModes, SecureJsonData } from '../types';

const WIDTH_LONG = 40;

const CONFIG_SECTION_HEADERS = [
  { label: 'Connection and authentication', id: '' },
  { label: 'TLS', id: '' },
  { label: 'Advanced', id: '' },
  { label: 'Save and test', id: '' },
];

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

export const PostgresConfigEditor = (props: DataSourcePluginOptionsEditorProps<PostgresOptions, SecureJsonData>) => {
  useMigrateDatabaseFields(props);
  const { options, onOptionsChange } = props;
  return (
    <Stack justifyContent="space-between">
      <Box width="20%">
        <Stack>
          <Box flex={1}>
            <Text element="h4">PostgreSQL</Text>
            <Box paddingTop={2} width="100%">
              {CONFIG_SECTION_HEADERS.map((header, index) => (
                <div key={index}>
                  <InlineField label={`${index + 1}`} style={{ display: 'flex', alignItems: 'center' }} grow>
                    <LinkButton
                      variant="secondary"
                      fill="text"
                      onClick={(e) => {
                        e.preventDefault();
                        const target = document.getElementById(header.id);
                        if (target) {
                          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                    >
                      {header.label}
                    </LinkButton>
                  </InlineField>
                  <Space v={1} />
                </div>
              ))}
            </Box>
          </Box>
        </Stack>
      </Box>
      <Box width="60%">
        <ConnectionEditor options={options} onOptionsChange={onOptionsChange} />
        <TLSEditor options={options} onOptionsChange={onOptionsChange} />
        <DBOptionsEditor options={options} onOptionsChange={onOptionsChange} />
      </Box>
      <Box width="20%">
        <></>
      </Box>
    </Stack>
  );
};

const ConfigSection = (props: React.PropsWithChildren<{ title: string; description?: string; collapsed: boolean }>) => {
  const { children, title, description, collapsed } = props;
  return (
    <>
      <Box borderStyle="solid" borderColor="weak" paddingX={2} paddingTop={2} marginBottom={4}>
        <CollapsableSection label={<Text element="h3">{title}</Text>} isOpen={collapsed}>
          <div>
            {description ? <Text color="secondary">{description}</Text> : <></>}
            <Box direction="column" gap={2} marginTop={4}>
              {children}
            </Box>
          </div>
        </CollapsableSection>
      </Box>
    </>
  );
};

const UpdatedField = (
  props: React.PropsWithChildren<{ label: string; tooltip?: PopoverContent; icon?: IconName; required?: boolean }>
) => {
  const { children, label, tooltip, icon, required } = props;
  return (
    <Field
      label={
        <Label>
          <EditorStack gap={0.5}>
            <span>
              {label}
              {required ? '*' : ''}
            </span>
            {tooltip && (
              <Tooltip content={tooltip || ''}>
                <Icon name={icon || 'info-circle'} size="sm" />
              </Tooltip>
            )}
          </EditorStack>
        </Label>
      }
    >
      <div style={{ marginBlock: '8px' }}>{children}</div>
    </Field>
  );
};

export const ConnectionEditor = (props: DataSourcePluginOptionsEditorProps<PostgresOptions, SecureJsonData>) => {
  useMigrateDatabaseFields(props);
  const { options, onOptionsChange } = props;
  const jsonData = options.jsonData;
  const onDSOptionChanged = (property: keyof PostgresOptions) => {
    return (event: SyntheticEvent<HTMLInputElement>) => {
      onOptionsChange({ ...options, ...{ [property]: event.currentTarget.value } });
    };
  };
  const onResetPassword = () => {
    updateDatasourcePluginResetOption(props, 'password');
  };
  return (
    <ConfigSection
      title={`1. Connection and authentication settings`}
      description="Enter the PostgreSQL instance details."
      collapsed={true}
    >
      <Box flex={1} width={'100%'}>
        <Stack direction="row" gap={2}>
          <UpdatedField label="Host URL" required>
            <Input
              width={WIDTH_LONG}
              name="host"
              type="text"
              value={options.url || ''}
              placeholder="localhost:5432"
              onChange={onDSOptionChanged('url')}
            />
          </UpdatedField>
          <UpdatedField label="Database name" required>
            <Input
              width={WIDTH_LONG}
              name="database"
              value={jsonData.database || ''}
              placeholder="Database"
              onChange={onUpdateDatasourceJsonDataOption(props, 'database')}
            />
          </UpdatedField>
        </Stack>
      </Box>
      <Stack direction="row" gap={2}>
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
      </Stack>
      <Alert severity={'info'} title="Database Access">
        The database user should only be granted <code>SELECT</code> permissions on the specified database &amp; tables
        you want to query. Grafana does not validate that queries are safe so queries can contain any SQL statement. For
        example, statements like <code>DELETE FROM user;</code> and <code>DROP TABLE user;</code> would be executed. To
        protect against this we <strong>highly</strong> recommend you create a specific PostgreSQL user with restricted
        permissions. Check out the docs for more information.
      </Alert>
    </ConfigSection>
  );
};

export const TLSEditor = (props: DataSourcePluginOptionsEditorProps<PostgresOptions, SecureJsonData>) => {
  useMigrateDatabaseFields(props);
  const { options } = props;
  const onJSONDataOptionSelected = (property: keyof PostgresOptions) => {
    return (value: SelectableValue) => {
      updateDatasourcePluginJsonDataOption(props, property, value.value);
    };
  };
  const jsonData = options.jsonData;
  return (
    <ConfigSection title={`2. TLS settings`} collapsed={false}>
      <Box direction="column" gap={2} marginTop={3}>
        <Stack direction="row" gap={2}>
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
                          <i>File system path</i> will allow you to configure certificates by specifying paths to
                          existing certificates on the local file system where Grafana is running. Be sure that the file
                          is readable by the user executing the Grafana process.
                          <br />
                          <br />
                          Selecting <i>Certificate content</i> will allow you to configure certificates by specifying
                          its content. The content will be stored encrypted in Grafana&apos;s database. When connecting
                          to the database the certificates will be written as files to Grafana&apos;s configured data
                          path on the local file system.
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
        </Stack>
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
      </Box>
    </ConfigSection>
  );
};

export const DBOptionsEditor = (props: DataSourcePluginOptionsEditorProps<PostgresOptions, SecureJsonData>) => {
  useMigrateDatabaseFields(props);
  const { options, onOptionsChange } = props;
  const jsonData = options.jsonData;
  const onTimeScaleDBChanged = (event: SyntheticEvent<HTMLInputElement>) => {
    updateDatasourcePluginJsonDataOption(props, 'timescaledb', event.currentTarget.checked);
  };
  return (
    <ConfigSection title={`3. Advanced settings`} collapsed={false}>
      <ConnectionLimits options={options} onOptionsChange={onOptionsChange} />
      <UpdatedField
        label={`Min time interval`}
        tooltip={
          <span>
            A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example
            <code>1m</code> if your data is written every minute.
          </span>
        }
        icon={'info-circle'}
      >
        <Input
          placeholder="1m"
          value={jsonData.timeInterval || ''}
          onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
          width={WIDTH_LONG}
        />
      </UpdatedField>
      <UpdatedField
        label={'TimescaleDB'}
        tooltip={
          <span>
            TimescaleDB is a time-series database built as a PostgreSQL extension. If enabled, Grafana will use
            <code>time_bucket</code> in the <code>$__timeGroup</code> macro and display TimescaleDB specific aggregate
            functions in the query builder.
          </span>
        }
      >
        <Switch value={jsonData.timescaledb || false} onChange={onTimeScaleDBChanged} width={WIDTH_LONG} />
      </UpdatedField>
      {config.secureSocksDSProxyEnabled && (
        <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
      )}
    </ConfigSection>
  );
};
