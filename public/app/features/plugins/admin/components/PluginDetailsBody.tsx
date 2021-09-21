import React from 'react';
import { css, cx } from '@emotion/css';

import { AppPlugin, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CatalogPlugin, PluginTabLabels } from '../types';
import { VersionList } from '../components/VersionList';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { AppConfigCtrlWrapper } from '../../wrappers/AppConfigWrapper';
import { PluginDashboards } from '../../PluginDashboards';

type Props = {
  tab: { label: string };
  plugin: CatalogPlugin;
};

export function PluginDetailsBody({ tab, plugin }: Props): JSX.Element | null {
  const styles = useStyles2(getStyles);
  const { value: pluginConfig } = usePluginConfig(plugin);

  if (tab?.label === PluginTabLabels.OVERVIEW) {
    return (
      <div
        className={cx(styles.readme, styles.container)}
        dangerouslySetInnerHTML={{
          __html: plugin.details?.readme ?? 'No plugin help or readme markdown file was found',
        }}
      />
    );
  }

  if (tab?.label === PluginTabLabels.VERSIONS) {
    return (
      <div className={styles.container}>
        <VersionList versions={plugin.details?.versions} />
      </div>
    );
  }

  if (tab?.label === PluginTabLabels.CONFIG && pluginConfig?.angularConfigCtrl) {
    return (
      <div className={styles.container}>
        <AppConfigCtrlWrapper app={pluginConfig as AppPlugin} />
      </div>
    );
  }

  if (pluginConfig?.configPages) {
    for (const configPage of pluginConfig.configPages) {
      if (tab?.label === configPage.title) {
        return (
          <div className={styles.container}>
            {/* TODO: we should pass the query params down */}
            <configPage.body plugin={pluginConfig} query={{}} />
          </div>
        );
      }
    }
  }

  if (tab?.label === PluginTabLabels.DASHBOARDS && pluginConfig) {
    return (
      <div className={styles.container}>
        <PluginDashboards plugin={pluginConfig?.meta} />
      </div>
    );
  }

  return null;
}

export const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(3, 4)};
  `,
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
  `,
});
