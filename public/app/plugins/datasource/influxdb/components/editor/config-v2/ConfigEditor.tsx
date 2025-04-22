import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { AuthMethod, convertLegacyAuthProps } from '@grafana/plugin-ui';
import {
  Alert,
  Box,
  CertificationKey,
  CollapsableSection,
  Combobox,
  ComboboxOption,
  CustomHeadersSettings,
  Field,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  Input,
  Label,
  RadioButtonGroup,
  ScrollContainer,
  SecretInput,
  Space,
  Stack,
  TagsInput,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';

import { InfluxOptions, InfluxVersion } from '../../../types';
export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

// This file is where the various versions of InfluxDB are mapped to their respective
// supported query languages. This is used to populate the dropdown in the config editor.
//
// If you need to add a new version of InfluxDB, you will need to add it to this file.
import { LeftSideBar } from './LeftSideBar';
import { RADIO_BUTTON_OPTIONS, CONFIG_SECTION_HEADERS, httpModes, authenticationOptions } from './constants';
import { INFLUXDB_VERSION_MAP } from './versions';

const getQueryLanguageOptions = (productName: string): Array<{ value: string }> => {
  const product = INFLUXDB_VERSION_MAP.find(({ name }) => name === productName);
  return product?.queryLanguages?.map(({ name }) => ({ value: name })) ?? [];
};

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => {
  const styles = useStyles2(getInlineLabelStyles);
  const authProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });

  const [product, setProduct] = useState({
    name: options.jsonData.product || '',
    language: options.jsonData.version || '',
  });
  const [advancedHttpSettingsIsOpen, setAdvancedHttpSettingsIsOpen] = useState(() => {
    const hasKeepCookies = 'keepCookies' in options.jsonData;
    const hasTimeout = 'timeout' in options.jsonData;
    return hasKeepCookies || hasTimeout;
  });
  const [advancedDbConnectionSettingsIsOpen, setAdvancedDbConnectionSettingsIsOpen] = useState(() => {
    const timeInterval = !!options.jsonData.timeInterval;
    const insecureGrpc = !!options.jsonData.insecureGrpc;
    return timeInterval || insecureGrpc;
  });

  const [authOptions, setAuthOptions] = useState({
    basicAuth: authProps.selectedMethod === AuthMethod.BasicAuth || false,
    tlsClientAuth: authProps.TLS?.TLSClientAuth.enabled || false,
    caCert: authProps.TLS?.selfSignedCertificate.enabled || false,
    skipTLS: authProps.TLS?.skipTLSVerification.enabled || false,
    oAuthForward: authProps.selectedMethod === AuthMethod.OAuthForward || false,
    withCredentials: options.withCredentials || false,
  });

  const [authenticationSettingsIsOpen, setAuthenticationSettingsIsOpen] = useState(() =>
    Object.values(authOptions).some(Boolean)
  );

  const onProductChange = ({ value }: ComboboxOption) => setProduct({ name: value, language: '' });
  const onQueryLanguageChange = ({ value }: ComboboxOption) => {
    setProduct((prev) => ({ ...prev, language: value }));
  };
  const onUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({ ...options, url: event.currentTarget.value });
    setProduct(({ name: '', language: ''}))
  };

  return (
    <>
      <Stack gap={0}>
        <LeftSideBar />
        <ScrollContainer height="calc(100vh - 56px)" scrollbarWidth="none" overflowY="auto" margin={2}>
          <Stack direction="column" width="75%">
            <Box
              borderStyle="solid"
              borderColor="weak"
              padding={2}
              marginBottom={4}
              id={`${CONFIG_SECTION_HEADERS[0].id}`}
            >
              <CollapsableSection
                label={<Text element="h3">1. {CONFIG_SECTION_HEADERS[0].label}</Text>}
                isOpen={CONFIG_SECTION_HEADERS[0].isOpen}
              >
                <Text>
                  Enter the URL of your InfluxDB instance, then select your product and query language. This will
                  determine the available settings and authentication methods in the next steps. If you are unsure what
                  product you are using, visit{' '}
                  <TextLink href="https://docs.influxdata.com/" external>
                    https://docs.influxdata.com/
                  </TextLink>
                  .
                </Text>
                <Box direction="column" gap={2} marginTop={3}>
                  <Field label={<div style={{ paddingBottom: '5px' }}>URL</div>}>
                    <Input placeholder="http://localhost:3000/" onChange={onUrlChange} value={options.url || ''} />
                  </Field>
                  <Box marginTop={2}>
                    <Stack direction="row" gap={2}>
                      <Box flex={1}>
                        <Field label={<div style={{ paddingBottom: '5px' }}>Product</div>}>
                          <Combobox
                            value={product.name}
                            options={INFLUXDB_VERSION_MAP.map(({ name }) => ({ value: name }))}
                            onChange={onProductChange}
                          />
                        </Field>
                      </Box>
                      <Box flex={1}>
                        <Field label={<div style={{ paddingBottom: '5px' }}>Query language</div>}>
                          <Combobox
                            value={product.name !== '' ? product.language : ''}
                            options={getQueryLanguageOptions(product.name)}
                            onChange={onQueryLanguageChange}
                          />
                        </Field>
                      </Box>
                    </Stack>
                  </Box>
                  <Space v={2} />
                  <Box display="flex" alignItems="center">
                    <InlineField label={<div className={cx(styles.label)}>Advanced HTTP Settings</div>} labelWidth={40}>
                      <InlineSwitch
                        value={advancedHttpSettingsIsOpen}
                        onChange={() => setAdvancedHttpSettingsIsOpen(!advancedHttpSettingsIsOpen)}
                      />
                    </InlineField>
                    {/* <Label style={{ marginRight: '10px', fontSize: '14px' }}>Advanced HTTP Settings</Label>
                    <Switch
                      value={advancedHttpSettingsIsOpen}
                      onChange={() => setAdvancedHttpSettingsIsOpen(!advancedHttpSettingsIsOpen)}
                    /> */}
                  </Box>
                  {advancedHttpSettingsIsOpen && options.access === 'proxy' && (
                    <>
                      <Space v={2} />
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          gap: '16px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <Field
                            label="Allowed cookies"
                            description={
                              <div style={{ height: '50px' }}>
                                Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should
                                be forwarded to the data source.
                              </div>
                            }
                            disabled={options.readOnly}
                            style={{ flex: 1 }}
                          >
                            <TagsInput
                              id="advanced-http-cookies"
                              placeholder="New cookie (hit enter to add)"
                              tags={
                                'keepCookies' in options.jsonData && Array.isArray(options.jsonData.keepCookies)
                                  ? options.jsonData.keepCookies
                                  : []
                              }
                              onChange={(e) => {
                                onOptionsChange({
                                  ...options,
                                  jsonData: {
                                    ...options.jsonData,
                                    ...{ keepCookies: e },
                                  },
                                });
                              }}
                            />
                          </Field>
                        </div>
                        <div style={{ flex: 1 }}>
                          <Field
                            htmlFor="advanced-http-timeout"
                            label="Timeout"
                            description={<div style={{ height: '50px' }}>HTTP request timeout in seconds.</div>}
                            disabled={options.readOnly}
                            style={{ flex: 1 }}
                          >
                            <Input
                              id="advanced-http-timeout"
                              type="number"
                              min={0}
                              placeholder="Timeout in seconds"
                              aria-label="Timeout in seconds"
                              value={
                                'timeout' in options.jsonData && typeof options.jsonData.timeout === 'number'
                                  ? options.jsonData.timeout.toString()
                                  : ''
                              }
                              onChange={(e) => {
                                const parsed = parseInt(e.currentTarget.value, 10);
                                onOptionsChange({
                                  ...options,
                                  jsonData: {
                                    ...options.jsonData,
                                    ...{ timeout: parsed },
                                  },
                                });
                              }}
                            />
                          </Field>
                        </div>
                      </div>
                      <Space v={1} />
                    </>
                  )}
                  {advancedHttpSettingsIsOpen && (
                    <CustomHeadersSettings dataSourceConfig={options} onChange={onOptionsChange} />
                  )}
                  {/* {!advancedHttpSettingsIsOpen && <Space v={3} />} */}
                  <Box display="flex" alignItems="center">
                  <InlineField label={<div className={cx(styles.label)}>Auth and TLS/SSL Settings</div>} labelWidth={35}>
                  <InlineSwitch
                        value={authenticationSettingsIsOpen}
                        onChange={() => setAuthenticationSettingsIsOpen(!authenticationSettingsIsOpen)}
                      />
                    </InlineField>
                    {/* <Label style={{ marginRight: '10px', fontSize: '14px' }}>Authentication and TLS/SSL Settings</Label>
                    <Switch
                      value={authenticationSettingsIsOpen}
                      onChange={() => setAuthenticationSettingsIsOpen(!authenticationSettingsIsOpen)}
                    /> */}
                  </Box>
                  {authenticationSettingsIsOpen && (
                    <>
                      <Space v={2} />
                      <Field label={<div style={{ paddingBottom: '5px' }}>Authentication Method</div>}>
                        <Combobox
                          options={Object.values(authenticationOptions)}
                          value={authProps.selectedMethod || authProps.mostCommonMethod}
                          onChange={(option) => {
                            authProps.onAuthMethodSelect(option.value);
                            setAuthOptions({
                              ...authOptions,
                              basicAuth: option.value === AuthMethod.BasicAuth,
                              oAuthForward: option.value === AuthMethod.OAuthForward,
                            });
                          }}
                        />
                      </Field>
                      <Field>
                        <>
                          {/* <Box display="flex" alignItems="center">
                          <Label style={{ width: '125px' }}>Basic Auth</Label>
                          <RadioButtonGroup
                            options={RADIO_BUTTON_OPTIONS}
                            value={connectionOptions.basicAuth}
                            onChange={() => {
                              setConnectionOptions({ ...connectionOptions, basicAuth: !connectionOptions.basicAuth });
                              onOptionsChange({ ...options, basicAuth: connectionOptions.basicAuth });
                            }}
                            size="sm"
                          />
                        </Box> */}
                          {authOptions.basicAuth && (
                            <>
                              <Space v={1} />
                              <Box display="flex" direction="column">
                                <Box width="60%">
                                  <InlineField label="User" labelWidth={14} grow>
                                    <Input
                                      placeholder="User"
                                      onChange={(e) =>
                                        onOptionsChange({ ...options, basicAuthUser: e.currentTarget.value })
                                      }
                                      value={options.basicAuthUser || ''}
                                    />
                                  </InlineField>
                                </Box>
                                <Box width="60%">
                                  <InlineField label="Password" labelWidth={14} grow>
                                    <SecretInput
                                      placeholder="Password"
                                      isConfigured={options.secureJsonFields.basicAuthPassword || false}
                                      onChange={(e) =>
                                        onOptionsChange({
                                          ...options,
                                          secureJsonData: {
                                            ...options.secureJsonData,
                                            basicAuthPassword: e.currentTarget.value,
                                          },
                                        })
                                      }
                                      onReset={() => {
                                        onOptionsChange({
                                          ...options,
                                          secureJsonData: {
                                            ...options.secureJsonData,
                                            basicAuthPassword: '',
                                          },
                                          secureJsonFields: {
                                            ...options.secureJsonFields,
                                            basicAuthPassword: false,
                                          },
                                        });
                                      }}
                                      onBlur={() => {
                                        onOptionsChange({
                                          ...options,
                                          secureJsonFields: {
                                            ...options.secureJsonFields,
                                            basicAuthPassword: true,
                                          },
                                        });
                                      }}
                                    />
                                  </InlineField>
                                </Box>
                              </Box>
                            </>
                          )}
                        </>
                      </Field>
                      <Field>
                        <>
                          <Text element="h5">TLS Settings</Text>
                          <Space v={2} />
                          <Box display="flex" alignItems="center">
                            <Label style={{ width: '125px' }}>TLS Client Auth</Label>
                            <RadioButtonGroup
                              options={RADIO_BUTTON_OPTIONS}
                              value={authOptions.tlsClientAuth}
                              onChange={() => {
                                setAuthOptions({
                                  ...authOptions,
                                  tlsClientAuth: !authOptions.tlsClientAuth,
                                });
                                authProps.TLS!.TLSClientAuth.onToggle(!authProps.TLS!.TLSClientAuth.enabled);
                              }}
                              size="sm"
                            />
                          </Box>
                          {authOptions.tlsClientAuth && (
                            <>
                              <Space v={3} />
                              <InlineField label="ServerName" labelWidth={14} grow>
                                <Input
                                  placeholder="domain.example.com"
                                  onChange={(e) =>
                                    authProps.TLS?.TLSClientAuth.onServerNameChange(e.currentTarget.value)
                                  }
                                  value={authProps.TLS?.TLSClientAuth.serverName || ''}
                                />
                              </InlineField>
                              <CertificationKey
                                label="Client Cert"
                                placeholder="Begins with -----BEGIN CERTIFICATE-----"
                                onChange={(e) =>
                                  authProps.TLS?.TLSClientAuth.onClientCertificateChange(e.currentTarget.value)
                                }
                                hasCert={!!authProps.TLS?.TLSClientAuth.clientCertificateConfigured}
                                onClick={() => authProps.TLS?.TLSClientAuth.onClientCertificateReset()}
                              />
                              <CertificationKey
                                label="Client Key"
                                placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
                                onChange={(e) => authProps.TLS?.TLSClientAuth.onClientKeyChange(e.currentTarget.value)}
                                hasCert={!!authProps.TLS?.TLSClientAuth.clientKeyConfigured}
                                onClick={() => authProps.TLS?.TLSClientAuth.onClientKeyReset()}
                              />
                            </>
                          )}
                        </>
                      </Field>
                      <Field>
                        <>
                          <Box display="flex" alignItems="center">
                            <Label style={{ width: '125px' }}>CA Cert</Label>
                            <RadioButtonGroup
                              options={RADIO_BUTTON_OPTIONS}
                              value={authOptions.caCert}
                              onChange={() => {
                                setAuthOptions({ ...authOptions, caCert: !authOptions.caCert });
                                authProps.TLS!.selfSignedCertificate.onToggle(
                                  !authProps.TLS!.selfSignedCertificate.enabled
                                );
                              }}
                              size="sm"
                            />
                          </Box>
                          {authOptions.caCert && (
                            <>
                              <Space v={3} />
                              <CertificationKey
                                label="CA Cert"
                                placeholder="Begins with -----BEGIN CERTIFICATE-----"
                                onChange={(e) =>
                                  authProps.TLS?.selfSignedCertificate.onCertificateChange(e.currentTarget.value)
                                }
                                hasCert={!!authProps.TLS?.selfSignedCertificate.certificateConfigured}
                                onClick={() => authProps.TLS?.selfSignedCertificate.onCertificateReset()}
                              />
                            </>
                          )}
                        </>
                      </Field>
                      {/* <Space v={1} /> */}
                      <Box display="flex" alignItems="center">
                        <Label style={{ width: '125px' }}>Skip TLS Verify</Label>
                        <RadioButtonGroup
                          options={RADIO_BUTTON_OPTIONS}
                          value={authOptions.skipTLS}
                          onChange={() => {
                            setAuthOptions({ ...authOptions, skipTLS: !authOptions.skipTLS });
                            authProps.TLS!.skipTLSVerification.onToggle(!authProps.TLS!.skipTLSVerification.enabled);
                          }}
                          size="sm"
                        />
                      </Box>
                      {/* <InlineField label="Skip TLS Verify" labelWidth={30}>
                        <InlineSwitch
                          value={authOptions.skipTLS}
                          onChange={() => {
                            setAuthOptions({ ...authOptions, skipTLS: !authOptions.skipTLS });
                            authProps.TLS!.skipTLSVerification.onToggle(!authProps.TLS!.skipTLSVerification.enabled);
                          }}
                        />
                      </InlineField> */}
                      {/* <InlineField
                        label="Forward OAuth Identity"
                        tooltip="Forward the user's upstream OAuth identity to the data source (Their access token gets passed along)."
                        labelWidth={30}
                      >
                        <InlineSwitch
                          value={authOptions.oAuthForward}
                          onChange={(e) => {
                            setAuthOptions({
                              ...authOptions,
                              oAuthForward: !authOptions.oAuthForward,
                            });
                            authProps.selectedMethod === AuthMethod.OAuthForward
                              ? authProps.onAuthMethodSelect(AuthMethod.NoAuth)
                              : authProps.onAuthMethodSelect(AuthMethod.OAuthForward);
                          }}
                        />
                      </InlineField> */}
                      {/* <InlineField
                        label="With Credentials"
                        tooltip="Whether credentials such as cookies or auth headers should be sent with cross-site requests."
                        labelWidth={30}
                      >
                        <InlineSwitch
                          value={authOptions.withCredentials}
                          onChange={() => {
                            setAuthOptions({
                              ...authOptions,
                              withCredentials: !authOptions.withCredentials,
                            });
                            onOptionsChange({ ...options, withCredentials: !options.withCredentials });
                          }}
                        />
                      </InlineField> */}
                    </>
                  )}
                </Box>
              </CollapsableSection>
            </Box>
            <Box
              borderStyle="solid"
              borderColor="weak"
              padding={2}
              marginBottom={4}
              id={`${CONFIG_SECTION_HEADERS[1].id}`}
            >
              <CollapsableSection
                label={<Text element="h3">2. {CONFIG_SECTION_HEADERS[1].label}</Text>}
                isOpen={CONFIG_SECTION_HEADERS[1].isOpen}
              >
              {/* <Box display="flex" justifyContent="space-between" alignItems="center">
                <Text element="h2">{CONFIG_SECTION_HEADERS[1].label}</Text>
                <div style={{ display: 'flex' }}>
                  <Label style={{ marginRight: '10px' }}>Advanced Settings</Label>
                  <Switch
                    value={dbConnectionAdvancedSettings}
                    onChange={() => setDBConnectionAdvancedSettings(!dbConnectionAdvancedSettings)}
                  />
                </div>
              </Box> */}
              {product.language === InfluxVersion.InfluxQL && (
                <>
                  <Alert severity="info" title="Database Access">
                    <p>
                      Setting the database for this datasource does not deny access to other databases. The InfluxDB query syntax
                      allows switching the database in the query. For example:
                      <code>SHOW MEASUREMENTS ON _internal</code> or
                      <code>SELECT * FROM &quot;_internal&quot;..&quot;database&quot; LIMIT 10</code>
                      <br />
                      <br />
                      To support data isolation and security, make sure appropriate permissions are configured in InfluxDB.
                    </p>
                  </Alert>
                </>
              )}
              <Text>
                Provide the necessary database connection details based on your selected InfluxDB product and query
                language.
              </Text>
              <>
                <Space v={2} />
                {(product.language === InfluxVersion.SQL ||
                  product.language === InfluxVersion.InfluxQL) && (
                    <>
                      <InlineFieldRow>
                        <InlineField label="Database" labelWidth={30} grow>
                          <Input
                            value={options.jsonData.dbName}
                            onChange={(event) => {
                              onOptionsChange({
                                ...options,
                                jsonData: {
                                  ...options.jsonData,
                                  dbName: event.currentTarget.value,
                                },
                              });
                            }}
                          />
                        </InlineField>
                      </InlineFieldRow>
                    </>
                  )}
                {product.language === InfluxVersion.InfluxQL && (
                  <>
                    <InlineFieldRow>
                      <InlineField label="User" labelWidth={30} grow>
                        <Input
                          value={options.user || ''}
                          onChange={(e) => onOptionsChange({ ...options, user: e.currentTarget.value })}
                        />
                      </InlineField>
                    </InlineFieldRow>
                    <InlineFieldRow>
                      <InlineField label="Password" labelWidth={30} grow>
                        <SecretInput
                          isConfigured={Boolean(options.secureJsonFields && options.secureJsonFields.password)}
                          value={''}
                          onReset={() => {}}
                          onChange={() => {}}
                        />
                      </InlineField>
                    </InlineFieldRow>
                  </>
                )}
                {product.language === InfluxVersion.Flux && (
                  <>
                    <InlineFieldRow>
                      <InlineField label="Organization" labelWidth={30} grow>
                        <Input
                          value={options.jsonData.organization || ''}
                          onChange={(e) =>
                            onOptionsChange({
                              ...options,
                              jsonData: { ...options.jsonData, organization: e.currentTarget.value },
                            })
                          }
                        />
                      </InlineField>
                    </InlineFieldRow>
                    <InlineFieldRow>
                      <InlineField labelWidth={30} label="Default Bucket" grow>
                        <Input
                          placeholder="default bucket"
                          value={options.jsonData.defaultBucket || ''}
                          onChange={(e) =>
                            onOptionsChange({
                              ...options,
                              jsonData: { ...options.jsonData, defaultBucket: e.currentTarget.value },
                            })
                          }
                        />
                      </InlineField>
                    </InlineFieldRow>
                  </>
                )}
                {(product.language === InfluxVersion.Flux ||
                  product.language === InfluxVersion.SQL) && (
                    <>
                      <InlineFieldRow>
                        <InlineField labelWidth={30} label="Token">
                          <SecretInput
                            isConfigured={options.secureJsonFields.token || false}
                            onChange={(e) =>
                              onOptionsChange({
                                ...options,
                                secureJsonData: {
                                  ...options.secureJsonData,
                                  token: e.currentTarget.value,
                                },
                              })
                            }
                            onReset={() => {
                              onOptionsChange({
                                ...options,
                                secureJsonData: {
                                  ...options.secureJsonData,
                                  token: '',
                                },
                                secureJsonFields: {
                                  ...options.secureJsonFields,
                                  token: false,
                                },
                              });
                            }}
                            onBlur={() => {
                              onOptionsChange({
                                ...options,
                                secureJsonFields: {
                                  ...options.secureJsonFields,
                                  token: true,
                                },
                              });
                            }}
                          />
                        </InlineField>
                      </InlineFieldRow>
                    </>
                  )}
                  <Space v={2} />
                  <InlineField label={<div className={cx(styles.label)}>Advanced Database Settings</div>} labelWidth={40}>
                      <InlineSwitch
                        value={advancedDbConnectionSettingsIsOpen}
                        onChange={() => setAdvancedDbConnectionSettingsIsOpen(!advancedDbConnectionSettingsIsOpen)}
                      />
                    </InlineField>
                  {advancedDbConnectionSettingsIsOpen && <Space v={2} />}
                  {product.language === InfluxVersion.InfluxQL && advancedDbConnectionSettingsIsOpen && (
                  <>
                    <InlineFieldRow>
                      <InlineField
                        label="HTTP Method"
                        labelWidth={30}
                        tooltip="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
                      method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
                      will restrict you and return an error if the query is too large."
                      >
                        <Combobox
                          width={30}
                          value={httpModes.find((httpMode) => httpMode.value === options.jsonData.httpMode)}
                          options={httpModes}
                          onChange={(e) =>
                            onOptionsChange({ ...options, jsonData: { ...options.jsonData, httpMode: e.label } })
                          }
                        />
                      </InlineField>
                    </InlineFieldRow>
                  </>
                )}
                {product.language === InfluxVersion.SQL && advancedDbConnectionSettingsIsOpen && (
                  <>
                    <InlineFieldRow>
                      <InlineField label="Insecure Connection" labelWidth={30}>
                        <InlineSwitch
                          className="width-15"
                          value={options.jsonData.insecureGrpc ?? false}
                          onChange={(event) => {
                            onOptionsChange({
                              ...options,
                              jsonData: {
                                ...options.jsonData,
                                insecureGrpc: event.currentTarget.checked,
                              },
                            });
                          }}
                        />
                      </InlineField>
                    </InlineFieldRow>
                  </>
                )}
                {(product.language === InfluxVersion.InfluxQL || product.language === InfluxVersion.Flux) &&
                  advancedDbConnectionSettingsIsOpen && (
                    <>
                      <InlineFieldRow>
                        <InlineField
                          label="Min time interval"
                          labelWidth={30}
                          tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example 1m if your data is written every minute."
                        >
                          <Input
                            className="width-15"
                            placeholder="10s"
                            value={options.jsonData.timeInterval || ''}
                            onChange={(e) =>
                              onOptionsChange({
                                ...options,
                                jsonData: { ...options.jsonData, timeInterval: e.currentTarget.value },
                              })
                            }
                          />
                        </InlineField>
                      </InlineFieldRow>
                    </>
                  )}
              </>
              </CollapsableSection>
            </Box>
          </Stack>
        </ScrollContainer>
      </Stack>
    </>
  );
};

export const getInlineLabelStyles = (theme: GrafanaTheme2, transparent = false, width?: number | 'auto') => {
  return {
    label: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      padding: theme.spacing(0, 1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.md,
      backgroundColor: transparent ? 'transparent' : theme.colors.background.secondary,
      height: theme.spacing(theme.components.height.md),
      lineHeight: theme.spacing(theme.components.height.md),
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      border: 'none',
      width: '240px',
      color: theme.colors.text.primary,
    }),
  }
};
