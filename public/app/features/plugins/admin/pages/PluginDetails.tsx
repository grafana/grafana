import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Icon, Alert } from '@grafana/ui';
import { AppNotificationSeverity } from 'app/types';
import { InstallControls } from '../components/InstallControls';
import { usePlugin } from '../hooks/usePlugins';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { Page } from 'app/core/components/Page/Page';
import { PluginLogo } from '../components/PluginLogo';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useLoadPluginAndNav } from '../hooks/useLoadPluginAndNav';
import { PluginDetailsBody } from '../components/PluginDetailsBody';

type PluginDetailsProps = GrafanaRouteComponentProps<{ pluginId?: string }>;

export default function PluginDetails({ match }: PluginDetailsProps): JSX.Element | null {
  const { pluginId } = match.params;
  const [activeTab, setActiveTab] = useState(0);
  const { isLoading, local, remote, remoteVersions } = usePlugin(pluginId!);
  const { loading, error, plugin, tabs } = useLoadPluginAndNav(pluginId!, Boolean(local));
  const tab = tabs[activeTab];
  const styles = useStyles2(getStyles);

  const description = remote?.description ?? local?.info?.description;
  const readme = remote?.readme || 'No plugin help or readme markdown file was found';
  const version = local?.info?.version || remote?.version;
  const links = (local?.info?.links || remote?.json?.info?.links) ?? [];
  const downloads = remote?.downloads;

  if (isLoading || loading) {
    return (
      <Page>
        <Loader />
      </Page>
    );
  }

  return (
    <Page>
      <PluginPage>
        <div className={styles.headerContainer}>
          <PluginLogo
            plugin={remote ?? local}
            className={css`
              object-fit: cover;
              width: 100%;
              height: 68px;
              max-width: 68px;
            `}
          />

          <div className={styles.headerWrapper}>
            <h1>{remote?.name ?? local?.name}</h1>
            <div className={styles.headerLinks}>
              <a className={styles.headerOrgName} href={'/plugins'}>
                {remote?.orgName ?? local?.info?.author?.name}
              </a>
              {links.map((link: any) => (
                <a key={link.name} href={link.url}>
                  {link.name}
                </a>
              ))}
              {downloads && (
                <span>
                  <Icon name="cloud-download" />
                  {` ${new Intl.NumberFormat().format(downloads)}`}{' '}
                </span>
              )}
              {version && <span>{version}</span>}
            </div>
            <p>{description}</p>
            {remote && <InstallControls localPlugin={local} remotePlugin={remote} />}
          </div>
        </div>
        <TabsBar>
          {tabs.map((tab, idx) => (
            <Tab key={tab.label} label={tab.label} active={idx === activeTab} onChangeTab={() => setActiveTab(idx)} />
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

          <PluginDetailsBody tab={tab} plugin={plugin} remoteVersions={remoteVersions ?? []} readme={readme} />
        </TabContent>
      </PluginPage>
    </Page>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
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
});
