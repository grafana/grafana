import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Drawer, Text, TextLink, Switch, useStyles2 } from '@grafana/ui';

export interface Props {
  onClose: () => void;
}

const SETTINGS_URL = '/api/admin/settings';

export const AuthDrawer = ({ onClose }: Props) => {
  const [isOauthAllowInsecureEmailLookup, setOauthAllowInsecureEmailLookup] = useState(false);

  const getSettings = async () => {
    try {
      const response = await getBackendSrv().get(SETTINGS_URL);
      setOauthAllowInsecureEmailLookup(response.auth.oauth_allow_insecure_email_lookup?.toLowerCase?.() === 'true');
    } catch (error) {}
  };
  const updateSettings = async (property: boolean) => {
    try {
      const body = {
        updates: {
          auth: {
            oauth_allow_insecure_email_lookup: '' + property,
          },
        },
      };
      await getBackendSrv().put(SETTINGS_URL, body);
    } catch (error) {}
  };

  const resetButtonOnClick = async () => {
    try {
      const body = {
        removals: {
          auth: ['oauth_allow_insecure_email_lookup'],
        },
      };
      await getBackendSrv().put(SETTINGS_URL, body);
      getSettings();
    } catch (error) {}
  };

  const oauthAllowInsecureEmailLookupOnChange = async () => {
    updateSettings(!isOauthAllowInsecureEmailLookup);
    setOauthAllowInsecureEmailLookup(!isOauthAllowInsecureEmailLookup);
  };

  const subtitle = (
    <>
      Configure auth settings. Find out more in our{' '}
      <TextLink
        external={true}
        href="https://grafana.com/docs/grafana/next/setup-grafana/configure-security/configure-authentication/#settings"
      >
        documentation
      </TextLink>
      .
    </>
  );

  const styles = useStyles2(getStyles);

  getSettings();

  return (
    <Drawer title="Auth Settings" subtitle={subtitle} size="md" onClose={onClose}>
      <div className={styles.advancedAuth}>
        <Text variant="h4">Advanced Auth</Text>
        <Text variant="h5">Enable insecure email lookup</Text>
        <Text variant="body" color="secondary">
          Allow users to use the same email address to log into Grafana with different identity providers.
        </Text>
        <Switch value={isOauthAllowInsecureEmailLookup} onChange={oauthAllowInsecureEmailLookupOnChange} />
      </div>
      <Button
        size="md"
        variant="secondary"
        className={styles.button}
        onClick={resetButtonOnClick}
        tooltip="This action will disregard any saved changes and load the configuration from the configuration file."
      >
        Reset
      </Button>
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    advancedAuth: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    button: css({
      marginTop: theme.spacing(2),
    }),
  };
};
