import { isEmpty } from 'lodash';
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { reportInteraction } from '@grafana/runtime';
import { Box, Grid } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import ConfigureAuthCTA from './components/ConfigureAuthCTA';
import { ProviderCard } from './components/ProviderCard';
import { loadSettings } from './state/actions';
import { getProviderUrl } from './utils';

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
  const enabledProviders = authProviders.filter((p) => providerStatuses[p.id]?.enabled);
  const configuredProviders = authProviders.filter(
    (p) => providerStatuses[p.id]?.configured && !providerStatuses[p.id]?.enabled
  );
  const availableProviders = authProviders.filter(
    (p) => !providerStatuses[p.id]?.enabled && !providerStatuses[p.id]?.configured && !providerStatuses[p.id]?.hide
  );
  const firstAvailableProvider = availableProviders?.length ? availableProviders[0] : null;

  {
    /* TODO: make generic for the provider of the configuration or make the documentation point to a collection of all our providers */
  }
  const docsLink = (
    <a
      className="external-link"
      href="https://grafana.com/docs/grafana/next/setup-grafana/configure-security/configure-authentication/saml-ui/"
      target="_blank"
      rel="noopener noreferrer"
    >
      documentation.
    </a>
  );

  const subTitle = <span>Manage your auth settings and configure single sign-on. Find out more in our {docsLink}</span>;

  const onCTAClick = () => {
    reportInteraction('authentication_ui_created', { provider: firstAvailableProvider?.type });
  };
  const onProviderCardClick = (providerType: string) => {
    reportInteraction('authentication_ui_provider_clicked', { provider: providerType });
  };

  return (
    <Page navId="authentication" subTitle={subTitle}>
      <Page.Contents isLoading={isLoading}>
        <Grid gap={3} minColumnWidth={34}>
          {!!providers?.length &&
            providers.map(({ provider, settings }) => (
              <ProviderCard
                key={provider}
                authType={'OAuth'}
                providerId={provider}
                displayName={provider}
                enabled={settings.enabled}
                onClick={() => onProviderCardClick(provider)}
              />
            ))}
        </Grid>
        {!enabledProviders?.length && firstAvailableProvider && !isEmpty(providerStatuses) && (
          <ConfigureAuthCTA
            title={`You have no ${firstAvailableProvider.type} configuration created at the moment`}
            buttonIcon="plus-circle"
            buttonLink={getProviderUrl(firstAvailableProvider)}
            buttonTitle={`Configure ${firstAvailableProvider.type}`}
            onClick={onCTAClick}
          />
        )}
        {!!configuredProviders?.length && (
          <Box paddingTop={3}>
            <Grid gap={3} minColumnWidth={34}>
              {configuredProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  providerId={provider.id}
                  displayName={providerStatuses[provider.id]?.name || provider.displayName}
                  authType={provider.protocol}
                  enabled={providerStatuses[provider.id]?.enabled}
                  configPath={provider.configPath}
                  onClick={() => onProviderCardClick(provider.type)}
                />
              ))}
            </Grid>
          </Box>
        )}
      </Page.Contents>
    </Page>
  );
};

export default connector(AuthConfigPageUnconnected);
