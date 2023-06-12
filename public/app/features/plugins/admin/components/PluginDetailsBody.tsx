import { css, cx } from '@emotion/css';
import React from 'react';

import { AppPlugin, GrafanaTheme2, PluginContextProvider, UrlQueryMap } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VersionList } from '../components/VersionList';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { CatalogPlugin, PluginTabIds } from '../types';

import { AppConfigCtrlWrapper } from './AppConfigWrapper';
import { PluginDashboards } from './PluginDashboards';
import { PluginUsage } from './PluginUsage';

type Props = {
  plugin: CatalogPlugin;
  queryParams: UrlQueryMap;
  pageId: string;
};

export function PluginDetailsBody({ plugin, queryParams, pageId }: Props): JSX.Element {
  const styles = useStyles2(getStyles);
  const { value: pluginConfig } = usePluginConfig(plugin);

  if (pageId === PluginTabIds.OVERVIEW) {
    return (
      <div
        className={cx(styles.readme, styles.container)}
        dangerouslySetInnerHTML={{
          __html: plugin.details?.readme ?? 'No plugin help or readme markdown file was found',
        }}
      />
    );
  }

  if (pageId === PluginTabIds.VERSIONS) {
    return (
      <div className={styles.container}>
        <VersionList versions={plugin.details?.versions} installedVersion={plugin.installedVersion} />
      </div>
    );
  }

  if (pageId === PluginTabIds.CONFIG && pluginConfig?.angularConfigCtrl) {
    return (
      <div className={styles.container}>
        <AppConfigCtrlWrapper app={pluginConfig as AppPlugin} />
      </div>
    );
  }

  if (pluginConfig?.configPages) {
    for (const configPage of pluginConfig.configPages) {
      if (pageId === configPage.id) {
        return (
          <div className={styles.container}>
            <PluginContextProvider meta={pluginConfig.meta}>
              <configPage.body plugin={pluginConfig} query={queryParams} />
            </PluginContextProvider>
          </div>
        );
      }
    }
  }

  if (pageId === PluginTabIds.USAGE && pluginConfig) {
    return (
      <div className={styles.container}>
        <PluginUsage plugin={pluginConfig?.meta} />
      </div>
    );
  }

  if (pageId === PluginTabIds.DASHBOARDS && pluginConfig) {
    return (
      <div className={styles.container}>
        <PluginDashboards plugin={pluginConfig?.meta} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <p>Page not found.</p>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  container: css``,
  readme: css`
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

    a {
      color: ${theme.colors.text.link};

      &:hover {
        color: ${theme.colors.text.link};
        text-decoration: underline;
      }
    }

    table {
      table-layout: fixed;
      width: 100%;

      td,
      th {
        overflow-x: auto;
        padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      }

      table,
      th,
      td {
        border: 1px solid ${theme.colors.border.medium};
        border-collapse: collapse;
      }
    }
  `,
});
