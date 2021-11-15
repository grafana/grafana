import React from 'react';
import { css } from '@emotion/css';

import { config } from '@grafana/runtime';
import { HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, PluginType } from '@grafana/data';

import { ExternallyManagedButton } from './ExternallyManagedButton';
import { InstallControlsButton } from './InstallControlsButton';
import { CatalogPlugin, PluginStatus, Version } from '../../types';
import { getExternalManageLink } from '../../helpers';
import { useIsRemotePluginsAvailable } from '../../state/hooks';
import { isGrafanaAdmin } from '../../permissions';

interface Props {
  plugin: CatalogPlugin;
  latestCompatibleVersion?: Version;
}

export const InstallControls = ({ plugin, latestCompatibleVersion }: Props) => {
  const styles = useStyles2(getStyles);
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = isGrafanaAdmin();
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const isCompatible = Boolean(latestCompatibleVersion);

  const pluginStatus = plugin.isInstalled
    ? plugin.hasUpdate
      ? PluginStatus.UPDATE
      : PluginStatus.UNINSTALL
    : PluginStatus.INSTALL;

  if (plugin.isCore || plugin.isDisabled || plugin.type === PluginType.renderer) {
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

  if (!plugin.isPublished) {
    return (
      <div className={styles.message}>
        <Icon name="exclamation-triangle" /> This plugin is not published to{' '}
        <a href="https://www.grafana.com/plugins" target="__blank" rel="noreferrer">
          grafana.com/plugins
        </a>{' '}
        and can&#39;t be managed via the catalog.
      </div>
    );
  }

  if (!isCompatible) {
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

  return (
    <InstallControlsButton
      plugin={plugin}
      pluginStatus={pluginStatus}
      latestCompatibleVersion={latestCompatibleVersion}
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
