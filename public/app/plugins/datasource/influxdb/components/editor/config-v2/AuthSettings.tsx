import { cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import {
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
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
  useStyles2,
  Text,
  Stack,
} from '@grafana/ui';

import { AUTH_RADIO_BUTTON_OPTIONS, getInlineLabelStyles, RADIO_BUTTON_OPTIONS } from './constants';
import {
  trackInfluxDBConfigV2AuthSettingsAuthMethodSelected,
  trackInfluxDBConfigV2AuthSettingsToggleClicked,
} from './tracking';
import { Props } from './types';

type AuthOptionState = {
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

  /**
   * Derived props from legacy helpers
   */
  const authProps = useMemo(
    () =>
      convertLegacyAuthProps({
        config: options,
        onChange: onOptionsChange,
      }),
    [options, onOptionsChange]
  );

  /**
   * Selected authentication method. Fallback to the most common if the selected one is missing.
   */
  const isAuthMethod = (v: unknown): v is AuthMethod =>
    v === AuthMethod.NoAuth || v === AuthMethod.BasicAuth || v === AuthMethod.OAuthForward;

  const selectedMethod = useMemo<AuthMethod | undefined>(() => {
    if (isAuthMethod(authProps.selectedMethod)) {
      return authProps.selectedMethod;
    }
    return isAuthMethod(authProps.mostCommonMethod) ? authProps.mostCommonMethod : undefined;
  }, [authProps.selectedMethod, authProps.mostCommonMethod]);

  /**
   * Local UI state
   */
  const [authOptions, setAuthOptions] = useState<AuthOptionState>({
    basicAuth: selectedMethod === AuthMethod.BasicAuth,
    tlsClientAuth: authProps.TLS?.TLSClientAuth.enabled ?? false,
    caCert: authProps.TLS?.selfSignedCertificate.enabled ?? false,
    skipTLS: authProps.TLS?.skipTLSVerification.enabled ?? false,
    oAuthForward: selectedMethod === AuthMethod.OAuthForward,
    withCredentials: options.withCredentials ?? false,
  });

  /**
   * Expand/collapse top–level section
   */
  const [authenticationSettingsIsOpen, setAuthenticationSettingsIsOpen] = useState(
    Object.values(authOptions).some(Boolean)
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
        basicAuth: option === AuthMethod.BasicAuth,
        oAuthForward: option === AuthMethod.OAuthForward,
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
      {/* Header toggle */}
      <Box alignItems="center">
        <InlineField label={<div className={cx(styles.label)}>Auth and TLS/SSL Settings</div>} labelWidth={35}>
          <InlineSwitch
            data-testid="influxdb-v2-config-auth-settings-toggle"
            value={authenticationSettingsIsOpen}
            onChange={toggleOpen}
          />
        </InlineField>
      </Box>

      {/* Collapsible settings body */}
      {authenticationSettingsIsOpen && (
        <Box paddingLeft={1}>
          {/* Authentication Method */}
          <Box marginBottom={2}>
            <Field label={<Text element="h5">Authentication Method</Text>} noMargin>
              <Box width="50%" marginY={2}>
                <RadioButtonGroup
                  options={AUTH_RADIO_BUTTON_OPTIONS}
                  value={selectedMethod}
                  onChange={handleAuthMethodChange}
                />
              </Box>
            </Field>
          </Box>

          <Box marginBottom={2}>
            {/* Basic Auth settings */}
            {authOptions.basicAuth && (
              <>
                <Box display="flex" direction="column" width="60%" marginBottom={2}>
                  <InlineField label="User" labelWidth={14} grow>
                    <Input
                      placeholder="User"
                      onChange={onUpdateDatasourceOption(props, 'basicAuthUser')}
                      value={options.basicAuthUser || ''}
                    />
                  </InlineField>
                  <InlineField label="Password" labelWidth={14} grow>
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
            )}
          </Box>

          {/* TLS Client Auth */}
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
                    />
                    <CertificationKey
                      label="Client Key"
                      placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
                      onChange={(e) => authProps.TLS?.TLSClientAuth.onClientKeyChange(e.currentTarget.value)}
                      hasCert={!!authProps.TLS?.TLSClientAuth.clientKeyConfigured}
                      onClick={() => authProps.TLS?.TLSClientAuth.onClientKeyReset()}
                    />
                  </Box>
                )}
              </>
            </Field>
          </Box>

          {/* CA Cert */}
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
                    />
                  </Box>
                )}
              </>
            </Field>
          </Box>

          {/* Skip TLS verify */}
          <Box display="flex" direction="row" alignItems="center">
            <Label style={{ width: '125px' }}>Skip TLS Verify</Label>
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
