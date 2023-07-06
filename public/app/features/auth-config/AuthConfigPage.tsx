import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
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
  const enabledProviders = authProviders.filter((p) => providerStatuses[p.id]?.enabled);
  const configuresProviders = authProviders.filter(
    (p) => providerStatuses[p.id]?.configured && !providerStatuses[p.id]?.enabled
  );
  const availableProviders = authProviders.filter(
    (p) => !providerStatuses[p.id]?.enabled && !providerStatuses[p.id]?.configured
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
  const onProviderCardClick = (provider: AuthProviderInfo) => {
    reportInteraction('authentication_ui_provider_clicked', { provider: provider.type });
  };

  return (
    <Page navId="authentication" subTitle={subTitle}>
      <Page.Contents isLoading={isLoading}>
        <h3 className={styles.sectionHeader}>Configured authentication</h3>
        {!!enabledProviders?.length && (
          <div className={styles.cardsContainer}>
            {enabledProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                providerId={provider.id}
                displayName={provider.displayName}
                authType={provider.type}
                enabled={providerStatuses[provider.id]?.enabled}
                configFoundInIniFile={providerStatuses[provider.id]?.configFoundInIniFile}
                configPath={provider.configPath}
                onClick={() => {
                  onProviderCardClick(provider);
                }}
              />
            ))}
          </div>
        )}
        {!enabledProviders?.length && firstAvailableProvider && !isEmpty(providerStatuses) && (
          <ConfigureAuthCTA
            title={`You have no ${firstAvailableProvider.type} configuration created at the moment`}
            buttonIcon="plus-circle"
            buttonLink={getProviderUrl(firstAvailableProvider)}
            buttonTitle={`Configure ${firstAvailableProvider.type}`}
            description={`Important: if you have ${firstAvailableProvider.type} configuration enabled via the .ini file Grafana is using it.
              Configuring ${firstAvailableProvider.type} via UI will take precedence over any configuration in the .ini file.
              No changes will be written into .ini file.`}
            onClick={onCTAClick}
          />
        )}
        {!!configuresProviders?.length && (
          <div className={styles.cardsContainer}>
            {configuresProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                providerId={provider.id}
                displayName={provider.displayName}
                authType={provider.protocol}
                enabled={providerStatuses[provider.id]?.enabled}
                configFoundInIniFile={providerStatuses[provider.id]?.configFoundInIniFile}
                configPath={provider.configPath}
              />
            ))}
          </div>
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
