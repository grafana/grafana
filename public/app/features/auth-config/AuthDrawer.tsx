import { css } from '@emotion/css';
import { JSX } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, Text, TextLink, Switch, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { StoreState } from 'app/types';

import { loadSettings, saveSettings } from './state/actions';

interface OwnProps {
  onClose: () => void;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

const mapStateToProps = (state: StoreState) => {
  const allowInsecureEmail =
    state.authConfig.settings?.auth?.oauth_allow_insecure_email_lookup.toLowerCase() === 'true';
  return {
    allowInsecureEmail,
  };
};

const mapActionsToProps = {
  loadSettings,
  saveSettings,
};

const connector = connect(mapStateToProps, mapActionsToProps);

export const AuthDrawerUnconnected = ({
  allowInsecureEmail,
  loadSettings,
  onClose,
  saveSettings,
}: Props): JSX.Element => {
  const notifyApp = useAppNotification();

  const oauthAllowInsecureEmailLookupOnChange = async () => {
    try {
      await saveSettings({
        updates: {
          auth: {
            oauth_allow_insecure_email_lookup: '' + !allowInsecureEmail,
          },
        },
      });
      await loadSettings(false);
      notifyApp.success('Settings saved');
    } catch (error) {
      notifyApp.error('Failed to save settings');
    }
  };

  const resetButtonOnClick = async () => {
    try {
      await saveSettings({
        removals: {
          auth: ['oauth_allow_insecure_email_lookup'],
        },
      });
      await loadSettings(false);
      notifyApp.success('Settings saved');
    } catch (error) {
      notifyApp.error('Failed to save settings');
    }
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

  return (
    <Drawer title="Auth Settings" subtitle={subtitle} size="md" onClose={onClose}>
      <div className={styles.advancedAuth}>
        <Text variant="h4">Advanced Auth</Text>
        <Text variant="h5">Enable insecure email lookup</Text>
        <Text variant="body" color="secondary">
          Allow users to use the same email address to log into Grafana with different identity providers.
        </Text>
        <Switch value={allowInsecureEmail} onChange={oauthAllowInsecureEmailLookupOnChange} />
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

export default connector(AuthDrawerUnconnected);

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
