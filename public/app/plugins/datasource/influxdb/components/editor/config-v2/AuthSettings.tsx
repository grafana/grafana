import { cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';
import { useWindowSize } from 'react-use';

import {
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { AuthMethod, convertLegacyAuthProps } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
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
  useStyles2,
  Text,
  Stack,
  InlineLabel,
} from '@grafana/ui';

import {
  AUTH_RADIO_BUTTON_OPTIONS,
  DB_SETTINGS_LABEL_WIDTH,
  getInlineLabelStyles,
  RADIO_BUTTON_OPTIONS,
} from './constants';
import {
  trackInfluxDBConfigV2AuthSettingsAuthMethodSelected,
  trackInfluxDBConfigV2AuthSettingsToggleClicked,
} from './tracking';
import { Props } from './types';

type AuthOptionState = {
  noAuth: boolean;
  basicAuth: boolean;
  tlsClientAuth: boolean;
  caCert: boolean;
  skipTLS: boolean;
  oAuthForward: boolean;
  withCredentials: boolean;
};

export const AuthSettings = (props: Props) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getInlineLabelStyles);
  const { width } = useWindowSize();

  const authProps = useMemo(
    () =>
      convertLegacyAuthProps({
        config: options,
        onChange: onOptionsChange,
      }),
    [options, onOptionsChange]
  );

  const isAuthMethod = (v: unknown): v is AuthMethod =>
    v === AuthMethod.NoAuth || v === AuthMethod.BasicAuth || v === AuthMethod.OAuthForward;

  const [authOptions, setAuthOptions] = useState<AuthOptionState>({
    noAuth: (!options.basicAuth && !options.jsonData.oauthPassThru) ?? false,
    basicAuth: options.basicAuth ?? false,
    tlsClientAuth: authProps.TLS?.TLSClientAuth.enabled ?? false,
    caCert: authProps.TLS?.selfSignedCertificate.enabled ?? false,
    skipTLS: authProps.TLS?.skipTLSVerification.enabled ?? false,
    oAuthForward: options.jsonData.oauthPassThru ?? false,
    withCredentials: options.withCredentials ?? false,
  });

  const selectedMethod = useMemo<AuthMethod | undefined>(() => {
    if (isAuthMethod(authProps.selectedMethod) && authProps.selectedMethod !== AuthMethod.CrossSiteCredentials) {
      return authProps.selectedMethod;
    }

    switch (!!authOptions) {
      case authOptions.basicAuth:
        return AuthMethod.BasicAuth;
      case authOptions.oAuthForward:
        return AuthMethod.OAuthForward;
      case authOptions.noAuth:
        return AuthMethod.NoAuth;
      default:
        return undefined;
    }
  }, [authProps.selectedMethod, authOptions]);

  const [authenticationSettingsIsOpen, setAuthenticationSettingsIsOpen] = useState(() =>
    Object.entries(authOptions).some(([key, value]) => key !== 'noAuth' && Boolean(value))
  );

  const toggleOpen = useCallback(() => {
    setAuthenticationSettingsIsOpen((prev) => {
      trackInfluxDBConfigV2AuthSettingsToggleClicked();
      return !prev;
    });
  }, []);

  const handleAuthMethodChange = useCallback(
    (option: AuthMethod) => {
      authProps.onAuthMethodSelect(option);
      setAuthOptions((prev) => ({
        ...prev,
        noAuth: option === AuthMethod.NoAuth,
        basicAuth: option === AuthMethod.BasicAuth,
        oAuthForward: option === AuthMethod.OAuthForward,
        withCredentials: prev.withCredentials,
      }));
      trackInfluxDBConfigV2AuthSettingsAuthMethodSelected({ authMethod: option });
    },
    [authProps]
  );

  /**
   * Wraps the toggle of an auth option, updates the local state and calls the onToggle callback
   * provided by the legacy `authProps` provided by `@grafana/plugin-ui`.
   */
  const toggleOption = useCallback((key: keyof AuthOptionState, onToggle: (value: boolean) => void) => {
    setAuthOptions((prev) => {
      const nextValue = !prev[key];
      const next = { ...prev, [key]: nextValue };
      onToggle(nextValue);
      return next;
    });
  }, []);

  return (
    <Stack direction="column">
      <Box alignItems="center">
        <InlineField label={<div className={cx(styles.label)}>Auth and TLS/SSL Settings</div>} labelWidth={35}>
          <InlineSwitch
            data-testid="influxdb-v2-config-auth-settings-toggle"
            value={authenticationSettingsIsOpen}
            onChange={toggleOpen}
          />
        </InlineField>
      </Box>

      {authenticationSettingsIsOpen && (
        <Box paddingLeft={1}>
          <Box marginBottom={1}>
            <Field label={<Text element="h5">Authentication Method</Text>} noMargin>
              <Box width="50%" marginY={2}>
                <RadioButtonGroup
                  options={AUTH_RADIO_BUTTON_OPTIONS}
                  value={selectedMethod}
                  onChange={handleAuthMethodChange}
                  size={width < 1100 ? 'sm' : 'md'}
                />
              </Box>
            </Field>
          </Box>

          {authOptions.basicAuth && (
            <Box marginBottom={2}>
              <>
                <Box display="flex" direction="column" marginBottom={2}>
                  <InlineField label="User" labelWidth={DB_SETTINGS_LABEL_WIDTH} grow>
                    <Input
                      placeholder="User"
                      onChange={onUpdateDatasourceOption(props, 'basicAuthUser')}
                      value={options.basicAuthUser || ''}
                    />
                  </InlineField>
                  <InlineField label="Password" labelWidth={DB_SETTINGS_LABEL_WIDTH} grow>
                    <SecretInput
                      placeholder="Password"
                      isConfigured={options.secureJsonFields.basicAuthPassword || false}
                      onChange={onUpdateDatasourceSecureJsonDataOption(props, 'basicAuthPassword')}
                      onReset={() => updateDatasourcePluginResetOption(props, 'basicAuthPassword')}
                      value={options.secureJsonData?.basicAuthPassword || ''}
                    />
                  </InlineField>
                </Box>
              </>
            </Box>
          )}
          <Box display="flex" direction="row" alignItems="center" marginBottom={2}>
            <InlineLabel
              style={{ width: '150px' }}
              tooltip={'Whether credentials such as cookies or auth headers should be sent with cross-site requests.'}
            >
              With Credentials
            </InlineLabel>
            <InlineSwitch
              data-testid="influxdb-v2-config-auth-settings-with-credentials"
              value={authOptions.withCredentials}
              onChange={(e) => {
                authProps.onAuthMethodSelect(selectedMethod!);
                onOptionsChange({
                  ...options,
                  withCredentials: e.currentTarget.checked,
                  jsonData: {
                    ...options.jsonData,
                    oauthPassThru: selectedMethod === AuthMethod.OAuthForward,
                  },
                });
                setAuthOptions({
                  ...authOptions,
                  noAuth: selectedMethod === AuthMethod.NoAuth,
                  basicAuth: selectedMethod === AuthMethod.BasicAuth,
                  oAuthForward: selectedMethod === AuthMethod.OAuthForward,
                  withCredentials: e.currentTarget.checked,
                });
              }}
            />
          </Box>
          <Box marginBottom={2}>
            <Field noMargin>
              <>
                <Text element="h5">TLS Settings</Text>
                <Box
                  display="flex"
                  alignItems="center"
                  data-testid="influxdb-v2-config-auth-settings-tls-client-auth-toggle"
                  marginTop={2}
                >
                  <Label style={{ width: '125px' }}>TLS Client Auth</Label>
                  <RadioButtonGroup
                    options={RADIO_BUTTON_OPTIONS}
                    value={authOptions.tlsClientAuth}
                    onChange={() => toggleOption('tlsClientAuth', authProps.TLS!.TLSClientAuth.onToggle)}
                    size="sm"
                  />
                </Box>

                {authOptions.tlsClientAuth && (
                  <Box marginTop={2}>
                    <InlineField label="Server Name" labelWidth={14} grow>
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
                      useGrow={config.featureToggles.newInfluxDSConfigPageDesign}
                    />
                    <CertificationKey
                      label="Client Key"
                      placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
                      onChange={(e) => authProps.TLS?.TLSClientAuth.onClientKeyChange(e.currentTarget.value)}
                      hasCert={!!authProps.TLS?.TLSClientAuth.clientKeyConfigured}
                      onClick={() => authProps.TLS?.TLSClientAuth.onClientKeyReset()}
                      useGrow={config.featureToggles.newInfluxDSConfigPageDesign}
                    />
                  </Box>
                )}
              </>
            </Field>
          </Box>

          <Box marginBottom={2}>
            <Field noMargin>
              <>
                <Box display="flex" alignItems="center" data-testid="influxdb-v2-config-auth-settings-ca-cert-toggle">
                  <Label style={{ width: '125px' }}>CA Cert</Label>
                  <RadioButtonGroup
                    options={RADIO_BUTTON_OPTIONS}
                    value={authOptions.caCert}
                    onChange={() => toggleOption('caCert', authProps.TLS!.selfSignedCertificate.onToggle)}
                    size="sm"
                  />
                </Box>
                {authOptions.caCert && (
                  <Box marginTop={3}>
                    <CertificationKey
                      label="CA Cert"
                      placeholder="Begins with -----BEGIN CERTIFICATE-----"
                      onChange={(e) => authProps.TLS?.selfSignedCertificate.onCertificateChange(e.currentTarget.value)}
                      hasCert={!!authProps.TLS?.selfSignedCertificate.certificateConfigured}
                      onClick={() => authProps.TLS?.selfSignedCertificate.onCertificateReset()}
                      useGrow={config.featureToggles.newInfluxDSConfigPageDesign}
                    />
                  </Box>
                )}
              </>
            </Field>
          </Box>

          <Box display="flex" direction="row" alignItems="center">
            <InlineLabel style={{ width: '150px' }}>Skip TLS Verify</InlineLabel>
            <InlineSwitch
              data-testid="influxdb-v2-config-auth-settings-skip-tls-verify"
              value={authOptions.skipTLS}
              onChange={() => toggleOption('skipTLS', authProps.TLS!.skipTLSVerification.onToggle)}
            />
          </Box>
        </Box>
      )}
    </Stack>
  );
};
