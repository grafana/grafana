import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import { ProviderCard } from './components/ProviderCard';
import { loadSettings, loadProviderStatuses } from './state/actions';

import { getRegisteredAuthProviders } from '.';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    settings: state.authConfig.settings,
    providerStatuses: state.authConfig.providerStatuses,
  };
}

const mapDispatchToProps = {
  loadSettings,
  loadProviderStatuses,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const AuthConfigPageUnconnected = ({
  settings,
  providerStatuses,
  loadSettings,
  loadProviderStatuses,
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    loadSettings();
    loadProviderStatuses();
  }, [loadSettings, loadProviderStatuses]);

  const authProviders = getRegisteredAuthProviders();
  const enabledProviders = authProviders.filter((p) => providerStatuses[p.id]?.enabled);
  const availableProviders = authProviders.filter((p) => !providerStatuses[p.id]?.enabled);

  return (
    <Page navId="authentication">
      <Page.Contents>
        <h4>Advanced authentication</h4>
        <div className={styles.cardsContainer}>
          {enabledProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              providerId={provider.id}
              displayName={provider.displayName}
              authType={provider.type}
              enabled={providerStatuses[provider.id]?.enabled}
            />
          ))}
        </div>
        <div className={styles.cardsContainer}>
          {availableProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              providerId={provider.id}
              displayName={provider.displayName}
              authType={provider.type}
              enabled={providerStatuses[provider.id]?.enabled}
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
