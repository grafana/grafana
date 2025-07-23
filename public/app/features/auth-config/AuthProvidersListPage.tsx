import { JSX, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaEdition } from '@grafana/data/internal';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Grid, TextLink, ToolbarButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { config } from 'app/core/config';
import { StoreState } from 'app/types/store';

import AuthDrawer from './AuthDrawer';
import ConfigureAuthCTA from './components/ConfigureAuthCTA';
import { ProviderCard, ProviderSAMLCard, ProviderSCIMCard } from './components/ProviderCard';
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
  const [showSCIMBanner, setShowSCIMBanner] = useState(false);

  // Check if SCIM banner should be shown
  useEffect(() => {
    const isSCIMEnabled = config.featureToggles.enableSCIM || false;
    setShowSCIMBanner(isSCIMEnabled);
  }, []);

  const authProviders = getRegisteredAuthProviders();
  const availableProviders = authProviders.filter((p) => !providerStatuses[p.id]?.hide);
  const onProviderCardClick = (providerType: string, enabled: boolean) => {
    reportInteraction('authentication_ui_provider_clicked', { provider: providerType, enabled });
  };

  // filter out saml from sso providers because it is already included in availableProviders
  providers = providers.filter((p) => p.provider !== 'saml');

  providers = providers.map((p) => {
    if (p.provider === 'ldap') {
      return {
        ...p,
        settings: {
          ...p.settings,
          type: 'LDAP',
        },
      };
    }
    return p;
  });

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
        <Trans i18nKey="auth-config-auth-config-page-unconnected.subtitle">
          Manage your auth settings and configure single sign-on. Find out more in our{' '}
          <TextLink
            external={true}
            href="https://grafana.com/docs/grafana/next/setup-grafana/configure-security/configure-authentication"
          >
            documentation
          </TextLink>
          .
        </Trans>
      }
      actions={
        config.buildInfo.edition !== GrafanaEdition.OpenSource && (
          <ToolbarButton icon="cog" variant="canvas" onClick={() => setShowDrawer(true)}>
            <Trans i18nKey="auth-config.auth-config-page-unconnected.auth-settings">Auth settings</Trans>
          </ToolbarButton>
        )
      }
    >
      <Page.Contents isLoading={isLoading}>
        {showSCIMBanner && (
          <Alert severity="warning" title="" onRemove={() => setShowSCIMBanner(false)} style={{ marginBottom: 16 }}>
            <Trans i18nKey="auth-config.scim-banner.message">
              SCIM is currently in development and not recommended for production use. Please use with caution and
              expect potential changes.
            </Trans>
          </Alert>
        )}
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
            {config.buildInfo.edition === GrafanaEdition.OpenSource && (
              <>
                <ProviderSAMLCard />
                <ProviderSCIMCard />
              </>
            )}
            {showDrawer && <AuthDrawer onClose={() => setShowDrawer(false)}></AuthDrawer>}
          </Grid>
        )}
      </Page.Contents>
    </Page>
  );
};

export default connector(AuthConfigPageUnconnected);
