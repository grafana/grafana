import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import ConfigureAuthCTA from './components/ConfigureAuthCTA';
import { ProviderCard } from './components/ProviderCard';
import { loadSettings } from './state/actions';
import { AuthProviderInfo } from './types';
import { getProviderUrl } from './utils';

import { getRegisteredAuthProviders } from '.';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  const { isLoading, providerStatuses } = state.authConfig;
  return {
    isLoading,
    providerStatuses,
  };
}

const mapDispatchToProps = {
  loadSettings,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const AuthConfigPageUnconnected = ({ providerStatuses, isLoading, loadSettings }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const authProviders = getRegisteredAuthProviders();
  const checkProviderStatus = (provider: AuthProviderInfo) => {
    // if it is configured in the UI, that takes precidence it is enabled in the UI
    // might want to refactor to just have a enabled field from the backend that is specified
    console.log(`configuredinUI`);
    console.log(providerStatuses[provider.id]?.configuredInUI);
    console.log(`enabledInUI`);
    console.log(providerStatuses[provider.id]?.enabledInUI);
    console.log(`enabled`);
    console.log(providerStatuses[provider.id]?.enabled);
    if (providerStatuses[provider.id]?.configuredInUI !== undefined) {
      return providerStatuses[provider.id]?.configuredInUI || providerStatuses[provider.id]?.enabledInUI;
    }
    // check if it is enabled in the backend from the inifile
    return providerStatuses[provider.id]?.enabled;
  };
  const alreadyConfiguredProviders = authProviders.filter((p) => {
    console.log(`checkProviderStatus`);
    console.log(checkProviderStatus(p));
    return checkProviderStatus(p);
  });

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

  const onCTAClick = (provider: AuthProviderInfo) => {
    reportInteraction('authentication_ui_created', { provider: provider.type });
  };
  const onProviderCardClick = (provider: AuthProviderInfo) => {
    reportInteraction('authentication_ui_provider_clicked', { provider: provider.type });
  };

  return (
    <Page navId="authentication" subTitle={subTitle}>
      <Page.Contents isLoading={isLoading}>
        <h3 className={styles.sectionHeader}>Configured authentication</h3>
        {authProviders.map((provider) =>
          alreadyConfiguredProviders.includes(provider) ? (
            <div className={styles.cardsContainer} key={provider.id}>
              <ProviderCard
                providerId={provider.id}
                displayName={provider.displayName}
                authType={provider.type}
                enabled={checkProviderStatus(provider)}
                configPath={provider.configPath}
                onClick={() => {
                  onProviderCardClick(provider);
                }}
              />
            </div>
          ) : (
            <ConfigureAuthCTA
              key={provider.id}
              title={`You have no ${provider.type} configuration created at the moment`}
              buttonIcon="plus-circle"
              buttonLink={getProviderUrl(provider)}
              buttonTitle={`Configure ${provider.type}`}
              onClick={() => {
                onCTAClick(provider);
              }}
            />
          )
        )}
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
      margin-top: ${theme.spacing(2)};
    `,
    sectionHeader: css`
      margin-bottom: ${theme.spacing(3)};
    `,
    settingsSection: css`
      margin-top: ${theme.spacing(4)};
    `,
    settingName: css`
      padding-left: 25px;
    `,
    doclink: css`
      padding-bottom: 5px;
      padding-top: -5px;
      font-size: ${theme.typography.bodySmall.fontSize};
      a {
        color: ${theme.colors.info.name}; // use theme link color or any other color
        text-decoration: underline; // underline or none, as you prefer
      }
    `,
    settingValue: css`
      white-space: break-spaces;
    `,
  };
};

export default connector(AuthConfigPageUnconnected);
