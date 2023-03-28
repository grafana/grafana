import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

import { ProviderCard } from './components/ProviderCard';
import { loadSettings, loadProviderStatuses } from './state/actions';
import { filterAuthSettings } from './utils';

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
  const authSettings = filterAuthSettings(settings);

  return (
    <Page navId="authentication">
      <Page.Contents>
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
              />
            ))}
          </div>
        )}
        {!!availableProviders?.length && (
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
        )}
        <div className={styles.settingsSection}>
          <h3>Settings</h3>
          {authSettings && (
            <table className="filter-table">
              <tbody>
                {Object.entries(authSettings).map(([sectionName, sectionSettings], i) => (
                  <React.Fragment key={`section-${i}`}>
                    <tr>
                      <td className="admin-settings-section">{sectionName}</td>
                      <td />
                    </tr>
                    {Object.entries(sectionSettings).map(([settingName, settingValue], j) => (
                      <tr key={`property-${j}`}>
                        <td style={{ paddingLeft: '25px' }}>{settingName}</td>
                        <td style={{ whiteSpace: 'break-spaces' }}>{settingValue}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
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
    sectionHeader: css`
      margin-bottom: ${theme.spacing(3)};
    `,
    settingsSection: css`
      margin-top: ${theme.spacing(4)};
    `,
  };
};

const AuthConfigPage = connector(AuthConfigPageUnconnected);
export default AuthConfigPage;
