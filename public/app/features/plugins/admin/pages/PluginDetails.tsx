import React, { useState, useMemo } from 'react';
import { css } from '@emotion/css';
import { AppPlugin, GrafanaTheme2, PluginType, PluginIncludeType } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Icon } from '@grafana/ui';
import { useAsync } from 'react-use';
import { contextSrv } from '../../../../core/services/context_srv';
import { VersionList } from '../components/VersionList';
import { InstallControls } from '../components/InstallControls';
import { usePlugin } from '../hooks/usePlugins';
import { Page as PluginPage } from '../components/Page';
import { Loader } from '../components/Loader';
import { Page } from 'app/core/components/Page/Page';
import { PluginLogo } from '../components/PluginLogo';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { loadPlugin } from '../../PluginPage';
import { AppConfigCtrlWrapper } from '../../wrappers/AppConfigWrapper';
import { PluginDashboards } from '../../PluginDashboards';

type PluginDetailsProps = GrafanaRouteComponentProps<{ pluginId?: string }>;

const defaultTabs = [{ label: 'Overview' }, { label: 'Version history' }];

const useLoadPlugin = (pluginId: string) => {
  const { loading, value: plugin, error } = useAsync(async () => {
    const plugin = await loadPlugin(pluginId);
    return plugin;
  }, [pluginId]);

  const tabs = useMemo(() => {
    const isAdmin = contextSrv.hasRole('Admin');
    const tabs: Array<{ label: string }> = [...defaultTabs];

    if (!plugin) {
      return tabs;
    }

    if (isAdmin) {
      if (plugin.meta.type === PluginType.app) {
        if (plugin.angularConfigCtrl) {
          tabs.push({
            label: 'Config',
          });
        }

        if (plugin.configPages) {
          for (const page of plugin.configPages) {
            tabs.push({
              label: page.title,
            });
          }
        }

        if (plugin.meta.includes?.find((include) => include.type === PluginIncludeType.dashboard)) {
          tabs.push({
            label: 'Dashboards',
          });
        }
      }
    }

    return tabs;
  }, [plugin]);

  return {
    loading,
    plugin,
    tabs,
    error,
  };
};

export default function PluginDetails({ match }: PluginDetailsProps): JSX.Element | null {
  const { pluginId } = match.params;
  const [activeTab, setActiveTab] = useState(0);
  const { isLoading, local, remote, remoteVersions } = usePlugin(pluginId!);
  const { loading, error, plugin, tabs } = useLoadPlugin(pluginId!);
  const tab = tabs[activeTab];
  const styles = useStyles2(getStyles);

  const description = remote?.description ?? local?.info?.description;
  const readme = remote?.readme;
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

  // if error whadda we do????

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
          {tab?.label === 'Overview' && (
            <div
              className={styles.readme}
              dangerouslySetInnerHTML={{ __html: readme ?? 'No plugin help or readme markdown file was found' }}
            />
          )}
          {tab?.label === 'Version history' && <VersionList versions={remoteVersions ?? []} />}

          {tab?.label === 'Dashboards' && plugin && (
            <div
              className={css`
                padding: 40px;
              `}
            >
              <PluginDashboards plugin={plugin.meta} />
            </div>
          )}

          {tab?.label === 'Config' && plugin?.angularConfigCtrl && (
            <div
              className={css`
                padding: 40px;
              `}
            >
              <AppConfigCtrlWrapper app={plugin as AppPlugin} />
            </div>
          )}
        </TabContent>
      </PluginPage>
    </Page>
  );
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
    message: css`
      color: ${theme.colors.text.secondary};
    `,
    readme: css`
      padding: ${theme.spacing(3, 4)};

      & img {
        max-width: 100%;
      }

      h1,
      h2,
      h3 {
        margin-top: ${theme.spacing(3)};
        margin-bottom: ${theme.spacing(2)};
      }

      *:first-child {
        margin-top: 0;
      }

      li {
        margin-left: ${theme.spacing(2)};
        & > p {
          margin: ${theme.spacing()} 0;
        }
      }
    `,
  };
};
