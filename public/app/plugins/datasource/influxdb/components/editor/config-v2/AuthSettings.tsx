import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';
import { useWindowSize } from 'react-use';

import {
  GrafanaTheme2,
  onUpdateDatasourceOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { AuthMethod, convertLegacyAuthProps } from '@grafana/plugin-ui';
import { Box, Field, Input, RadioButtonGroup, SecretInput, useStyles2, Stack, Checkbox, Button } from '@grafana/ui';

import { AUTH_RADIO_BUTTON_OPTIONS } from './constants';
import {
  trackInfluxDBConfigV2AuthSettingsAuthMethodSelected,
  trackInfluxDBConfigV2AuthSettingsToggleClicked,
} from './tracking';
import { Props } from './types';

type AuthOptions = {
  noAuth: boolean;
  basicAuth: boolean;
  oAuthForward: boolean;
  withCredentials: boolean;
};

export const AuthSettings = (props: Props) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getStyles);
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

  const [authOptions, setAuthOptions] = useState<AuthOptions>({
    noAuth: (!options.basicAuth && !options.jsonData.oauthPassThru) ?? false,
    basicAuth: options.basicAuth ?? false,
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

  return (
    <Stack direction="column">
      <Box alignItems="center">
        <Button
          icon={authenticationSettingsIsOpen ? 'angle-down' : 'angle-right'}
          size="sm"
          variant="secondary"
          onClick={toggleOpen}
          className={styles.httpSettingsButton}
          data-testid="influxdb-v2-config-auth-settings-toggle"
        >
          Authentication settings
        </Button>
      </Box>
      {authenticationSettingsIsOpen && (
        <div style={{ marginLeft: '30px' }}>
          <Box width="50%">
            <RadioButtonGroup
              options={AUTH_RADIO_BUTTON_OPTIONS}
              value={selectedMethod}
              onChange={handleAuthMethodChange}
              size={width < 1100 ? 'sm' : 'md'}
            />
          </Box>
          {authOptions.basicAuth && (
            <Box marginBottom={2} marginTop={2}>
              <Box display="flex" direction="column" marginBottom={2} width="50%">
                <Field label="User" noMargin>
                  <Input
                    data-testid="influxdb-v2-config-auth-username"
                    placeholder="User"
                    onChange={onUpdateDatasourceOption(props, 'basicAuthUser')}
                    value={options.basicAuthUser || ''}
                  />
                </Field>
              </Box>
              <Box display="flex" direction="column" width="50%">
                <Field label="Password" noMargin>
                  <SecretInput
                    placeholder="Password"
                    isConfigured={options.secureJsonFields.basicAuthPassword || false}
                    onChange={onUpdateDatasourceSecureJsonDataOption(props, 'basicAuthPassword')}
                    onReset={() => updateDatasourcePluginResetOption(props, 'basicAuthPassword')}
                    value={options.secureJsonData?.basicAuthPassword || ''}
                  />
                </Field>
              </Box>
            </Box>
          )}
          <Box display="flex" direction="row" alignItems="center" marginBottom={2} marginTop={2}>
            <Checkbox
              label="With credentials"
              description="Check to send cookies or auth headers with cross-site requests"
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
        </div>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      padding: theme.spacing(0, 1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.md,
      backgroundColor: theme.colors.background.secondary,
      height: theme.spacing(theme.components.height.md),
      lineHeight: theme.spacing(theme.components.height.md),
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      border: 'none',
      width: '220px',
      color: theme.colors.text.primary,
    }),
    httpSettingsButton: css({ marginBottom: theme.spacing(2) }),
  };
};
