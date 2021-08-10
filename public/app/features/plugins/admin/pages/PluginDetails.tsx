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
  const breadcrumbHref = match.url.substring(0, match.url.lastIndexOf('/'));

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
              alt={`${plugin.name} logo`}
              src={plugin.info.logos.small}
              className={css`
                object-fit: contain;
                width: 100%;
                height: 68px;
                max-width: 68px;
              `}
            />

            <div className={styles.headerWrapper}>
              <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                <ol>
                  <li>
                    <a
                      className={css`
                        text-decoration: underline;
                      `}
                      href={breadcrumbHref}
                    >
                      Plugins
                    </a>
                  </li>
                  <li>
                    <a href={`${match.url}`} aria-current="page">
                      {plugin.name}
                    </a>
                  </li>
                </ol>
              </nav>
              <div className={styles.headerLinks}>
                <span>{plugin.orgName}</span>
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
      margin-bottom: ${theme.spacing(3)};
      margin-top: ${theme.spacing(3)};
      min-height: 120px;
    `,
    headerWrapper: css`
      margin-left: ${theme.spacing(3)};
    `,
    breadcrumb: css`
      font-size: ${theme.typography.h2.fontSize};
      li {
        display: inline;
        list-style: none;
        &::after {
          content: '/';
          padding: 0 0.25ch;
        }
        &:last-child::after {
          content: '';
        }
      }
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
        &:last-child::after {
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
