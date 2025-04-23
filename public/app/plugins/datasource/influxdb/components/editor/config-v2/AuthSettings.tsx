import { cx } from '@emotion/css';
import { useState } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { AuthMethod, convertLegacyAuthProps } from '@grafana/plugin-ui';
import {
  Box,
  CertificationKey,
  Field,
  InlineField,
  InlineSwitch,
  Input,
  Label,
  RadioButtonGroup,
  SecretInput,
  Space,
  useStyles2,
  Text,
} from '@grafana/ui';

import { InfluxOptions } from '../../../types';

import { AUTH_RADIO_BUTTON_OPTIONS, getInlineLabelStyles, RADIO_BUTTON_OPTIONS } from './constants';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export const AuthSettings = ({ options, onOptionsChange }: Props) => {
  const styles = useStyles2(getInlineLabelStyles);

  const authProps = convertLegacyAuthProps({
    config: options,
    onChange: onOptionsChange,
  });

  const isAuthMethod = (v: unknown): v is AuthMethod =>
    v === AuthMethod.NoAuth || v === AuthMethod.BasicAuth || v === AuthMethod.OAuthForward;

  const selectedMethod = isAuthMethod(authProps.selectedMethod)
    ? authProps.selectedMethod
    : isAuthMethod(authProps.mostCommonMethod)
      ? authProps.mostCommonMethod
      : undefined;

  const [authOptions, setAuthOptions] = useState({
    basicAuth: authProps.selectedMethod === AuthMethod.BasicAuth,
    tlsClientAuth: authProps.TLS?.TLSClientAuth.enabled ?? false,
    caCert: authProps.TLS?.selfSignedCertificate.enabled ?? false,
    skipTLS: authProps.TLS?.skipTLSVerification.enabled ?? false,
    oAuthForward: authProps.selectedMethod === AuthMethod.OAuthForward,
    withCredentials: options.withCredentials ?? false,
  });

  const [authenticationSettingsIsOpen, setAuthenticationSettingsIsOpen] = useState(() =>
    Object.values(authOptions).some(Boolean)
  );

  return (
    <>
      <Box display="flex" alignItems="center">
        <InlineField label={<div className={cx(styles.label)}>Auth and TLS/SSL Settings</div>} labelWidth={35}>
          <InlineSwitch
            value={authenticationSettingsIsOpen}
            onChange={() => setAuthenticationSettingsIsOpen(!authenticationSettingsIsOpen)}
          />
        </InlineField>
      </Box>
      {authenticationSettingsIsOpen && (
        <div style={{ paddingLeft: '10px' }}>
          <Space v={2} />
          <Field label={<Text element="h5">Authentication Method</Text>}>
            <div style={{ width: '50%', display: 'flex', marginTop: '20px' }}>
              <RadioButtonGroup
                options={AUTH_RADIO_BUTTON_OPTIONS}
                value={selectedMethod}
                onChange={(option: AuthMethod) => {
                  authProps.onAuthMethodSelect(option);
                  setAuthOptions({
                    ...authOptions,
                    basicAuth: option === AuthMethod.BasicAuth,
                    oAuthForward: option === AuthMethod.OAuthForward,
                  });
                }}
              />
            </div>
          </Field>
          <Field>
            <>
              {authOptions.basicAuth && (
                <>
                  <Space v={1} />
                  <Box display="flex" direction="column">
                    <Box width="60%">
                      <InlineField label="User" labelWidth={14} grow>
                        <Input
                          placeholder="User"
                          onChange={(e) => onOptionsChange({ ...options, basicAuthUser: e.currentTarget.value })}
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
              <Space v={3} />
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
          <Field>
            <>
              <Box display="flex" alignItems="center">
                <Label style={{ width: '125px' }}>CA Cert</Label>
                <RadioButtonGroup
                  options={RADIO_BUTTON_OPTIONS}
                  value={authOptions.caCert}
                  onChange={() => {
                    setAuthOptions({ ...authOptions, caCert: !authOptions.caCert });
                    authProps.TLS!.selfSignedCertificate.onToggle(!authProps.TLS!.selfSignedCertificate.enabled);
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
                    onChange={(e) => authProps.TLS?.selfSignedCertificate.onCertificateChange(e.currentTarget.value)}
                    hasCert={!!authProps.TLS?.selfSignedCertificate.certificateConfigured}
                    onClick={() => authProps.TLS?.selfSignedCertificate.onCertificateReset()}
                  />
                </>
              )}
            </>
          </Field>
          <Box display="flex" alignItems="center">
            <Label style={{ width: '125px' }}>Skip TLS Verify</Label>
            <InlineSwitch
              value={authOptions.skipTLS}
              onChange={() => {
                setAuthOptions({ ...authOptions, skipTLS: !authOptions.skipTLS });
                authProps.TLS!.skipTLSVerification.onToggle(!authProps.TLS!.skipTLSVerification.enabled);
              }}
            />
          </Box>
        </div>
      )}
    </>
  );
};
