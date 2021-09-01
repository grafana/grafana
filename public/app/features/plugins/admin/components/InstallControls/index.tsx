import React from 'react';
import { css } from '@emotion/css';
import { satisfies } from 'semver';

import { config } from '@grafana/runtime';
import { HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

import { CatalogPlugin, PluginStatus } from '../../types';
import { isGrafanaAdmin, getExternalManageLink } from '../../helpers';
import { ExternallyManagedButton } from './ExternallyManagedButton';
import { InstallControlsButton } from './InstallControlsButton';

interface Props {
  plugin: CatalogPlugin;
  isInflight: boolean;
  hasUpdate: boolean;
  hasInstalledPanel: boolean;
  isInstalled: boolean;
  dispatch: React.Dispatch<any>;
}

export const InstallControls = ({ plugin, isInflight, hasUpdate, isInstalled, hasInstalledPanel, dispatch }: Props) => {
  const styles = useStyles2(getStyles);
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = isGrafanaAdmin();
  const grafanaDependency = plugin.details?.grafanaDependency;
  const unsupportedGrafanaVersion = grafanaDependency
    ? !satisfies(config.buildInfo.version, grafanaDependency, {
        // needed for when running against master
        includePrerelease: true,
      })
    : false;
  const pluginStatus = isInstalled ? (hasUpdate ? PluginStatus.UPDATE : PluginStatus.UNINSTALL) : PluginStatus.INSTALL;

  if (plugin.isCore) {
    return null;
  }

  if (plugin.isEnterprise && !config.licenseInfo?.hasValidLicense) {
    return (
      <HorizontalGroup height="auto" align="center">
        <span className={styles.message}>No valid Grafana Enterprise license detected.</span>
        <LinkButton
          href={`${getExternalManageLink(plugin.id)}?utm_source=grafana_catalog_learn_more`}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          fill="text"
          icon="external-link-alt"
        >
          Learn more
        </LinkButton>
      </HorizontalGroup>
    );
  }

  if (plugin.isDev) {
    return (
      <div className={styles.message}>This is a development build of the plugin and can&#39;t be uninstalled.</div>
    );
  }

  if (!hasPermission && !isExternallyManaged) {
    const message = `You do not have permission to ${pluginStatus} this plugin.`;
    return <div className={styles.message}>{message}</div>;
  }

  if (unsupportedGrafanaVersion) {
    return (
      <div className={styles.message}>
        <Icon name="exclamation-triangle" />
        &nbsp;This plugin doesn&#39;t support your version of Grafana.
      </div>
    );
  }

  if (isExternallyManaged) {
    return <ExternallyManagedButton pluginId={plugin.id} pluginStatus={pluginStatus} />;
  }

  return (
    <InstallControlsButton
      isInProgress={isInflight}
      dispatch={dispatch}
      plugin={plugin}
      pluginStatus={pluginStatus}
      hasInstalledPanel={hasInstalledPanel}
    />
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css`
      color: ${theme.colors.text.secondary};
    `,
  };
};
