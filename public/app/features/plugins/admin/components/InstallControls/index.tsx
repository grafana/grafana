import React from 'react';
import { css } from '@emotion/css';
import { satisfies } from 'semver';

import { config } from '@grafana/runtime';
import { HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

import { ExternallyManagedButton } from './ExternallyManagedButton';
import { InstallControlsButton } from './InstallControlsButton';
import { CatalogPlugin, PluginStatus } from '../../types';
import { isGrafanaAdmin, getExternalManageLink } from '../../helpers';
import { useIsRemotePluginsAvailable } from '../../state/hooks';

interface Props {
  plugin: CatalogPlugin;
}

export const InstallControls = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = isGrafanaAdmin();
  const grafanaDependency = plugin.details?.grafanaDependency;
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const unsupportedGrafanaVersion = grafanaDependency
    ? !satisfies(config.buildInfo.version, grafanaDependency, {
        // needed for when running against main
        includePrerelease: true,
      })
    : false;
  const pluginStatus = plugin.isInstalled
    ? plugin.hasUpdate
      ? PluginStatus.UPDATE
      : PluginStatus.UNINSTALL
    : PluginStatus.INSTALL;

  if (plugin.isCore || plugin.isDisabled) {
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

  if (!isRemotePluginsAvailable) {
    return (
      <div className={styles.message}>
        The install controls have been disabled because the Grafana server cannot access grafana.com.
      </div>
    );
  }

  return <InstallControlsButton plugin={plugin} pluginStatus={pluginStatus} />;
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css`
      color: ${theme.colors.text.secondary};
    `,
  };
};
