import React, { useState } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { AdvancedHttpSettings, AuthMethod, convertLegacyAuthProps } from '@grafana/plugin-ui';
import {
  Box,
  CertificationKey,
  Combobox,
  ComboboxOption,
  CustomHeadersSettings,
  Field,
  FieldSet,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  Input,
  RadioButtonGroup,
  SecretInput,
  Space,
  Stack,
  Text,
} from '@grafana/ui';

import { InfluxOptions } from '../../../types';
export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

// This file is where the various versions of InfluxDB are mapped to their respective
// supported query languages. This is used to populate the dropdown in the config editor.
//
// If you need to add a new version of InfluxDB, you will need to add it to this file.
import { LeftSideBar } from './LeftSideBar';
import { RADIO_BUTTON_OPTIONS, CONFIG_SECTION_HEADERS } from './constants';
import { INFLUXDB_VERSION_MAP } from './versions';

const getQueryLanguageOptions = (productName: string): Array<{ value: string }> => {
  const product = INFLUXDB_VERSION_MAP.find(({ name }) => name === productName);
  return product?.queryLanguages?.map(({ name }) => ({ value: name })) ?? [];
};

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }: Props) => {
  const authProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });

  const [product, setProduct] = useState({
    name: options.jsonData.product || '',
    language: options.jsonData.version || '',
  });
  const [connectionOptions, setConnectionOptions] = useState({
    basicAuth: options.basicAuth || false,
    tlsClientAuth: authProps.TLS?.TLSClientAuth.enabled || false,
    caCert: authProps.TLS?.selfSignedCertificate.enabled || false,
    skipTLS: authProps.TLS?.skipTLSVerification.enabled || false,
    forwardOAuth: authProps.selectedMethod === AuthMethod.OAuthForward || false,
    withCredentials: options.withCredentials || false,
  });

  const onProductChange = ({ value }: ComboboxOption) => setProduct({ name: value, language: '' });
  const onQueryLanguageChange = ({ value }: ComboboxOption) => setProduct((prev) => ({ ...prev, language: value }));
  const onUrlChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    onOptionsChange({ ...options, url: event.currentTarget.value });

  return (
    <>
      <Stack direction="row" gap={8}>
        <LeftSideBar />
        <Box flex={1} maxWidth="50%">
          <Box
            borderStyle="solid"
            borderColor="weak"
            padding={2}
            marginBottom={4}
            id={`${CONFIG_SECTION_HEADERS[0].id}`}
          >
            <FieldSet label={`1. ${CONFIG_SECTION_HEADERS[0].label}`}>
              <Text>
                Configure the connection settings for your InfluxDB instance. This needs to be accessible from your
                Grafana server.
              </Text>

              <Box direction="column" gap={2} marginTop={2}>
                <Field label="URL">
                  <Input placeholder="http://localhost:3000/" onChange={onUrlChange} />
                </Field>
                <Space v={1} />
                <AdvancedHttpSettings config={options} onChange={onOptionsChange} />
              </Box>
            </FieldSet>
          </Box>

          <Box
            borderStyle="solid"
            borderColor="weak"
            padding={2}
            marginBottom={4}
            id={`${CONFIG_SECTION_HEADERS[1].id}`}
          >
            <FieldSet label={`2. ${CONFIG_SECTION_HEADERS[1].label}`}>
              <Text>
                Select the InfluxDB product that you are configuring. This choice determines the available settings and
                authentication methods in the next steps. If you're unsure, check your InfluxDB version, or refer to the
                documentation.
              </Text>

              <Box marginTop={2}>
                <Stack direction="row" gap={2}>
                  <Box flex={1}>
                    <Field label="Product selection">
                      <Combobox
                        options={INFLUXDB_VERSION_MAP.map(({ name }) => ({ value: name }))}
                        onChange={onProductChange}
                      />
                    </Field>
                  </Box>
                  <Box flex={1}>
                    <Field label="Query language">
                      <Combobox
                        value={product.language}
                        options={getQueryLanguageOptions(product.name)}
                        onChange={onQueryLanguageChange}
                      />
                    </Field>
                  </Box>
                </Stack>
              </Box>
            </FieldSet>
          </Box>

          <Box
            borderStyle="solid"
            borderColor="weak"
            padding={2}
            marginBottom={4}
            id={`${CONFIG_SECTION_HEADERS[2].id}`}
          >
            <FieldSet label={`3. ${CONFIG_SECTION_HEADERS[2].label}`}>
              <Text>
                Configure authentication settings for your InfluxDB instance. This is required to access your data.
                Ensure to limit access to the necessary permissions only.
              </Text>
              <Space v={3} />
              <Field label="Basic Auth">
                <>
                  <RadioButtonGroup
                    options={RADIO_BUTTON_OPTIONS}
                    value={connectionOptions.basicAuth}
                    onChange={() => {
                      setConnectionOptions({ ...connectionOptions, basicAuth: !connectionOptions.basicAuth });
                      onOptionsChange({ ...options, basicAuth: connectionOptions.basicAuth });
                    }}
                  />
                  {connectionOptions.basicAuth && (
                    <>
                      <Space v={3} />
                      <InlineField label="User" labelWidth={14} grow>
                        <Input
                          placeholder="User"
                          style={{ width: '100%' }}
                          onChange={(e) => onOptionsChange({ ...options, basicAuthUser: e.currentTarget.value })}
                          value={options.basicAuthUser || ''}
                        />
                      </InlineField>
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
                    </>
                  )}
                </>
              </Field>
              <Field label="TLS Client Auth">
                <>
                  <RadioButtonGroup
                    options={RADIO_BUTTON_OPTIONS}
                    value={connectionOptions.tlsClientAuth}
                    onChange={() => {
                      setConnectionOptions({ ...connectionOptions, tlsClientAuth: !connectionOptions.tlsClientAuth });
                      authProps.TLS!.TLSClientAuth.onToggle(!authProps.TLS!.TLSClientAuth.enabled);
                    }}
                  />
                  {connectionOptions.tlsClientAuth && (
                    <>
                      <Space v={3} />
                      <InlineField label="ServerName" labelWidth={14} grow>
                        <Input
                          placeholder="domain.example.com"
                          onChange={(e) => authProps.TLS?.TLSClientAuth.onServerNameChange(e.currentTarget.value)}
                          value={authProps.TLS?.TLSClientAuth.serverName || ''}
                        />
                      </InlineField>
                      <CertificationKey
                        label="Client Cert"
                        placeholder="Begins with -----BEGIN CERTIFICATE-----"
                        onChange={(e) => authProps.TLS?.TLSClientAuth.onClientCertificateChange(e.currentTarget.value)}
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
              <Field label="CA Cert">
                <>
                  <RadioButtonGroup
                    options={RADIO_BUTTON_OPTIONS}
                    value={connectionOptions.caCert}
                    onChange={() => {
                      setConnectionOptions({ ...connectionOptions, caCert: !connectionOptions.caCert });
                      authProps.TLS!.selfSignedCertificate.onToggle(!authProps.TLS!.selfSignedCertificate.enabled);
                    }}
                  />
                  {connectionOptions.caCert && (
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
              <Space v={2} />
              <InlineField label="Skip TLS Verify" labelWidth={30}>
                <InlineSwitch
                  value={connectionOptions.skipTLS}
                  onChange={() => {
                    setConnectionOptions({ ...connectionOptions, skipTLS: !connectionOptions.skipTLS });
                    authProps.TLS!.skipTLSVerification.onToggle(!authProps.TLS!.skipTLSVerification.enabled);
                  }}
                />
              </InlineField>
              <InlineField
                label="Forward OAuth Identity"
                tooltip="Forward the user's upstream OAuth identity to the data source (Their access token gets passed along)."
                labelWidth={30}
              >
                <InlineSwitch
                  value={connectionOptions.forwardOAuth}
                  onChange={(e) => {
                    setConnectionOptions({ ...connectionOptions, forwardOAuth: !connectionOptions.forwardOAuth });
                    authProps.selectedMethod === AuthMethod.OAuthForward
                      ? authProps.onAuthMethodSelect(AuthMethod.NoAuth)
                      : authProps.onAuthMethodSelect(AuthMethod.OAuthForward);
                  }}
                />
              </InlineField>
              <InlineField
                label="With Credentials"
                tooltip="Whether credentials such as cookies or auth headers should be sent with cross-site requests."
                labelWidth={30}
              >
                <InlineSwitch
                  value={connectionOptions.withCredentials}
                  onChange={() => {
                    setConnectionOptions({ ...connectionOptions, withCredentials: !connectionOptions.withCredentials });
                    onOptionsChange({ ...options, withCredentials: !options.withCredentials });
                  }}
                />
              </InlineField>
              <Space v={3} />
              <CustomHeadersSettings dataSourceConfig={options} onChange={onOptionsChange} />
            </FieldSet>
          </Box>

          <Box
            borderStyle="solid"
            borderColor="weak"
            padding={2}
            marginBottom={4}
            id={`${CONFIG_SECTION_HEADERS[3].id}`}
          >
            <FieldSet label={`4. ${CONFIG_SECTION_HEADERS[3].label}`}>
              <Text>
                Configure SSL/TLS settings for secure communication with your InfluxDB instance. This is recommended for
                production environments.
              </Text>
              <>
                <Space v={2} />
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
                  <InlineField labelWidth={30} label="Token" grow>
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
                <InlineFieldRow>
                  <InlineField labelWidth={30} label="Default Bucket" grow>
                    <Input
                      placeholder="default bucket"
                      value={options.jsonData.defaultBucket || ''}
                      onChange={(e) => onOptionsChange({...options, jsonData: {...options.jsonData, defaultBucket: e.currentTarget.value}})}
                    />
                  </InlineField>
                </InlineFieldRow>
                <InlineFieldRow>
                  <InlineField
                    labelWidth={30}
                    label="Min time interval"
                    tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
                      for example 1m if your data is written every minute."
                    grow
                  >
                    <Input
                      placeholder="10s"
                      value={options.jsonData.timeInterval || ''}
                      onChange={(e) => onOptionsChange({...options, jsonData: {...options.jsonData, timeInterval: e.currentTarget.value}})}
                    />
                  </InlineField>
                </InlineFieldRow>
              </>
            </FieldSet>
          </Box>

          <Box
            borderStyle="solid"
            borderColor="weak"
            padding={2}
            marginBottom={4}
            id={`${CONFIG_SECTION_HEADERS[4].id}`}
          >
            <FieldSet label={`5. ${CONFIG_SECTION_HEADERS[4].label}`}>
              <Text>
                PDC is a feature that allows you to connect to your InfluxDB instance without exposing it to the public
                internet. This is useful for security reasons, or if your InfluxDB instance is behind a firewall.
              </Text>
            </FieldSet>
          </Box>
        </Box>
      </Stack>
    </>
  );
};
