import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import { ProviderCard } from './components/ProviderCard';
import { loadSettings } from './state/actions';

import { getAuthProviders } from '.';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    settings: state.authConfig.settings,
  };
}

const mapDispatchToProps = {
  loadSettings,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const AuthConfigPageUnconnected = ({ settings, loadSettings }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const authProviders = getAuthProviders(settings);
  const enabledProviders = authProviders.filter((p) => p.enabled === 'true');
  const availableProviders = authProviders.filter((p) => p.enabled !== 'true');
  console.log(authProviders);

  return (
    <Page navId="authentication">
      <Page.Contents>
        <h4>Advanced authentication</h4>
        <div className={styles.cardsContainer}>
          {enabledProviders.map((provider) => (
            <ProviderCard
              key={provider.providerId}
              providerId={provider.providerId}
              displayName={provider.name || provider.displayName}
              enabled={provider.enabled === 'true'}
            />
          ))}
        </div>
        <div className={styles.cardsContainer}>
          {availableProviders.map((provider) => (
            <ProviderCard
              key={provider.providerId}
              providerId={provider.providerId}
              displayName={provider.name || provider.displayName}
              enabled={provider.enabled === 'true'}
            />
          ))}
        </div>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardsContainer: css`
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
      gap: ${theme.spacing(3)};
      margin-bottom: ${theme.spacing(3)};
    `,
  };
};

const AuthConfigPage = connector(AuthConfigPageUnconnected);
export default AuthConfigPage;
