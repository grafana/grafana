import React, { useState } from 'react';
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

const useLoadPlugin = (pluginId: string) => {
  const { loading, value, error } = useAsync(async () => {
    const navItems = [];
    const plugin = await loadPlugin(pluginId);
    const isAdmin = contextSrv.hasRole('Admin');
    if (isAdmin) {
      if (plugin.meta.type === PluginType.app) {
        if (plugin.angularConfigCtrl) {
          navItems.push({
            label: 'Config',
            active: false,
          });
        }
      }

      if (plugin.configPages) {
        for (const page of plugin.configPages) {
          navItems.push({
            label: page.title,
            active: false,
          });
        }
      }
    }

    if (plugin.meta.includes?.find((include) => include.type === PluginIncludeType.dashboard)) {
      navItems.push({
        label: 'Dashboards',
        active: false,
      });
    }

    return {
      plugin,
      navItems,
    };
  }, [pluginId]);

  return {
    loading,
    plugin: value?.plugin,
    navItems: value?.navItems,
    error,
  };
};

const defaultTabs = [
  { label: 'Overview', active: true },
  { label: 'Version history', active: false },
];

export default function PluginDetails({ match }: PluginDetailsProps): JSX.Element | null {
  const { pluginId } = match.params;

  const { isLoading, local, remote, remoteVersions } = usePlugin(pluginId!);
  const { loading, error, plugin, navItems } = useLoadPlugin(pluginId!);
  const styles = useStyles2(getStyles);

  const description = remote?.description ?? local?.info?.description;
  const readme = remote?.readme;
  const version = local?.info?.version || remote?.version;
  const links = (local?.info?.links || remote?.json?.info?.links) ?? [];
  const downloads = remote?.downloads;

  const [tabs, setTabs] = useState(defaultTabs);

  console.log(loading, error, plugin, navItems);

  if (isLoading) {
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
          {tabs.map((tab, key) => (
            <Tab
              key={key}
              label={tab.label}
              active={tab.active}
              onChangeTab={() => {
                setTabs(tabs.map((tab, index) => ({ ...tab, active: index === key })));
              }}
            />
          ))}
        </TabsBar>
        <TabContent>
          {tabs.find((_) => _.label === 'Overview')?.active && (
            <div
              className={styles.readme}
              dangerouslySetInnerHTML={{ __html: readme ?? 'No plugin help or readme markdown file was found' }}
            />
          )}
          {tabs.find((_) => _.label === 'Version history')?.active && <VersionList versions={remoteVersions ?? []} />}

          {tabs.find((_) => _.label === 'Dashboards')?.active && plugin && <PluginDashboards plugin={plugin.meta} />}

          {tabs.find((_) => _.label === 'Config')?.active && plugin?.angularConfigCtrl && (
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
