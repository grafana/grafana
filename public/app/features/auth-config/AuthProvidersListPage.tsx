import React, { JSX, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaEdition } from '@grafana/data/src/types/config';
import { reportInteraction } from '@grafana/runtime';
import { Grid, TextLink, ToolbarButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { config } from 'app/core/config';
import { StoreState } from 'app/types';

import { AuthDrawer } from './AuthDrawer';
import ConfigureAuthCTA from './components/ConfigureAuthCTA';
import { ProviderCard } from './components/ProviderCard';
import { loadSettings } from './state/actions';

import { getRegisteredAuthProviders } from './index';

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

  const [showDrawer, setShowDrawer] = useState(false);

  const authProviders = getRegisteredAuthProviders();
  const availableProviders = authProviders.filter((p) => !providerStatuses[p.id]?.hide);
  const onProviderCardClick = (providerType: string, enabled: boolean) => {
    reportInteraction('authentication_ui_provider_clicked', { provider: providerType, enabled });
  };

  const providerList = availableProviders.length
    ? [
        ...availableProviders.map((p) => ({
          provider: p.id,
          settings: { ...providerStatuses[p.id], configPath: p.configPath, type: p.type },
        })),
        ...providers,
      ]
    : providers;
  return (
    <Page
      navId="authentication"
      subTitle={
        <>
          Manage your auth settings and configure single sign-on. Find out more in our{' '}
          <TextLink
            external={true}
            href="https://grafana.com/docs/grafana/next/setup-grafana/configure-security/configure-authentication"
          >
            documentation
          </TextLink>
          .
        </>
      }
      actions={
        config.buildInfo.edition !== GrafanaEdition.OpenSource && (
          <ToolbarButton icon="cog" variant="canvas" onClick={() => setShowDrawer(true)}>
            Auth settings
          </ToolbarButton>
        )
      }
    >
      <Page.Contents isLoading={isLoading}>
        {!providerList.length ? (
          <ConfigureAuthCTA />
        ) : (
          <Grid gap={3} minColumnWidth={34}>
            {providerList
              // Temporarily filter out providers that don't have the UI implemented
              .filter(({ provider }) => !['grafana_com'].includes(provider))
              .map(({ provider, settings }) => (
                <ProviderCard
                  key={provider}
                  authType={settings.type || 'OAuth'}
                  providerId={provider}
                  enabled={settings.enabled}
                  onClick={() => onProviderCardClick(provider, settings.enabled)}
                  //@ts-expect-error Remove legacy types
                  configPath={settings.configPath}
                />
              ))}
            {showDrawer && <AuthDrawer onClose={() => setShowDrawer(false)}></AuthDrawer>}
          </Grid>
        )}
      </Page.Contents>
    </Page>
  );
};

export default connector(AuthConfigPageUnconnected);
