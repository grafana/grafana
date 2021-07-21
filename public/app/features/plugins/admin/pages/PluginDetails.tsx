import React from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Icon, Alert } from '@grafana/ui';

import { AppNotificationSeverity } from 'app/types';
import { InstallControls } from '../components/InstallControls';
import { usePluginDetails } from '../hooks/usePluginDetails';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { Page } from 'app/core/components/Page/Page';
import { PluginLogo } from '../components/PluginLogo';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { ActionTypes } from '../types';
import { PluginDetailsBody } from '../components/PluginDetailsBody';

type PluginDetailsProps = GrafanaRouteComponentProps<{ pluginId?: string }>;

export default function PluginDetails({ match }: PluginDetailsProps): JSX.Element | null {
  const { pluginId } = match.params;
  const { state, dispatch } = usePluginDetails(pluginId!);
  const {
    loading,
    error,
    plugin,
    pluginConfig,
    tabs,
    activeTab,
    isInflight,
    hasUpdate,
    isInstalled,
    hasInstalledPanel,
  } = state;
  const tab = tabs[activeTab];
  const styles = useStyles2(getStyles);

  if (loading) {
    return (
      <Page>
        <Loader />
      </Page>
    );
  }

  if (plugin) {
    return (
      <Page>
        <PluginPage>
          <div className={styles.headerContainer}>
            <PluginLogo
              src={plugin.info.logos.small}
              className={css`
                object-fit: cover;
                width: 100%;
                height: 68px;
                max-width: 68px;
              `}
            />

            <div className={styles.headerWrapper}>
              <h1>{plugin.name}</h1>
              <div className={styles.headerLinks}>
                <a className={styles.headerOrgName} href={'/plugins'}>
                  {plugin.orgName}
                </a>
                {plugin.links.map((link: any) => (
                  <a key={link.name} href={link.url}>
                    {link.name}
                  </a>
                ))}
                {plugin.downloads > 0 && (
                  <span>
                    <Icon name="cloud-download" />
                    {` ${new Intl.NumberFormat().format(plugin.downloads)}`}{' '}
                  </span>
                )}
                {plugin.version && <span>{plugin.version}</span>}
              </div>
              <p>{plugin.description}</p>
              <InstallControls
                plugin={plugin}
                isInflight={isInflight}
                hasUpdate={hasUpdate}
                isInstalled={isInstalled}
                hasInstalledPanel={hasInstalledPanel}
                dispatch={dispatch}
              />
            </div>
          </div>
          <TabsBar>
            {tabs.map((tab: { label: string }, idx: number) => (
              <Tab
                key={tab.label}
                label={tab.label}
                active={idx === activeTab}
                onChangeTab={() => dispatch({ type: ActionTypes.SET_ACTIVE_TAB, payload: idx })}
              />
            ))}
          </TabsBar>
          <TabContent>
            {error && (
              <Alert severity={AppNotificationSeverity.Error} title="Error Loading Plugin">
                <>
                  Check the server startup logs for more information. <br />
                  If this plugin was loaded from git, make sure it was compiled.
                </>
              </Alert>
            )}
            <PluginDetailsBody
              tab={tab}
              plugin={pluginConfig}
              remoteVersions={plugin.versions}
              readme={plugin.readme}
            />
          </TabContent>
        </PluginPage>
      </Page>
    );
  }

  return null;
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    headerContainer: css`
      display: flex;
      margin-bottom: 24px;
      margin-top: 24px;
      min-height: 120px;
    `,
    headerWrapper: css`
      margin-left: ${theme.spacing(3)};
    `,
    headerLinks: css`
      display: flex;
      align-items: center;
      margin-top: ${theme.spacing()};
      margin-bottom: ${theme.spacing(3)};

      & > * {
        &::after {
          content: '|';
          padding: 0 ${theme.spacing()};
        }
      }
      & > *:last-child {
        &::after {
          content: '';
          padding-right: 0;
        }
      }
      font-size: ${theme.typography.h4.fontSize};
    `,
    headerOrgName: css`
      font-size: ${theme.typography.h4.fontSize};
    `,
  };
};
