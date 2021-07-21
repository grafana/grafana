import React from 'react';
import { css, cx } from '@emotion/css';

import { AppPlugin, GrafanaTheme2, GrafanaPlugin, PluginMeta } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { VersionList } from '../components/VersionList';
import { AppConfigCtrlWrapper } from '../../wrappers/AppConfigWrapper';
import { PluginDashboards } from '../../PluginDashboards';

type PluginDetailsBodyProps = {
  tab: { label: string };
  plugin: GrafanaPlugin<PluginMeta<{}>> | undefined;
  remoteVersions: Array<{ version: string; createdAt: string }>;
  readme: string;
};

export function PluginDetailsBody({ tab, plugin, remoteVersions, readme }: PluginDetailsBodyProps): JSX.Element | null {
  const styles = useStyles2(getStyles);

  if (tab?.label === 'Overview') {
    return (
      <div
        className={cx(styles.readme, styles.container)}
        dangerouslySetInnerHTML={{ __html: readme ?? 'No plugin help or readme markdown file was found' }}
      />
    );
  }

  if (tab?.label === 'Version history') {
    return (
      <div className={styles.container}>
        <VersionList versions={remoteVersions ?? []} />
      </div>
    );
  }

  if (tab?.label === 'Config' && plugin?.angularConfigCtrl) {
    return (
      <div className={styles.container}>
        <AppConfigCtrlWrapper app={plugin as AppPlugin} />
      </div>
    );
  }

  if (plugin?.configPages) {
    for (const configPage of plugin.configPages) {
      if (tab?.label === configPage.title) {
        return (
          <div className={styles.container}>
            <configPage.body plugin={plugin} query={{}} />
          </div>
        );
      }
    }
  }

  if (tab?.label === 'Dashboards' && plugin) {
    return (
      <div className={styles.container}>
        <PluginDashboards plugin={plugin.meta} />
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
