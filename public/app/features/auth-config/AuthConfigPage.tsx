import React, { JSX, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { reportInteraction } from '@grafana/runtime';
import { Grid } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import { ProviderCard } from './components/ProviderCard';
import { loadSettings } from './state/actions';

import { getRegisteredAuthProviders } from '.';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  const { isLoading, providerStatuses, providers } = state.authConfig;
  return {
    isLoading,
    providerStatuses,
    providers,
  };
}

const mapDispatchToProps = {
  loadSettings,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const AuthConfigPageUnconnected = ({
  providerStatuses,
  isLoading,
  loadSettings,
  providers,
}: Props): JSX.Element => {
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const authProviders = getRegisteredAuthProviders();
  const configuredProviders = authProviders.filter((p) => providerStatuses[p.id]?.configured);

  const onProviderCardClick = (providerType: string) => {
    reportInteraction('authentication_ui_provider_clicked', { provider: providerType });
  };

  const providerList = configuredProviders.length
    ? [
        ...configuredProviders.map((p) => ({ provider: p.id, settings: { ...providerStatuses[p.id], type: p.type } })),
        ...providers,
      ]
    : providers;
  return (
    <Page
      navId="authentication"
      subTitle={
        <>
          Manage your auth settings and configure single sign-on. Find out more in our{' '}
          <a
            className="external-link"
            href="https://grafana.com/docs/grafana/next/setup-grafana/configure-security/configure-authentication"
            target="_blank"
            rel="noopener noreferrer"
          >
            documentation.
          </a>
        </>
      }
    >
      <Page.Contents isLoading={isLoading}>
        <Grid gap={3} minColumnWidth={34}>
          {providerList.map(({ provider, settings }) => (
            <ProviderCard
              key={provider}
              authType={settings.type || 'OAuth'}
              providerId={provider}
              displayName={provider}
              enabled={settings.enabled}
              onClick={() => onProviderCardClick(provider)}
            />
          ))}
        </Grid>
      </Page.Contents>
    </Page>
  );
};

export default connector(AuthConfigPageUnconnected);
