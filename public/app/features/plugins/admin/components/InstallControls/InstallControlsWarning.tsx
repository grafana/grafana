import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PluginType } from '@grafana/data';
import { config, featureEnabled } from '@grafana/runtime';
import { HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

import { getExternalManageLink } from '../../helpers';
import { isGrafanaAdmin } from '../../permissions';
import { useIsRemotePluginsAvailable } from '../../state/hooks';
import { CatalogPlugin, PluginStatus, Version } from '../../types';

interface Props {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
  latestCompatibleVersion?: Version;
}

export const InstallControlsWarning = ({ plugin, pluginStatus, latestCompatibleVersion }: Props) => {
  const styles = useStyles2(getStyles);
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const hasPermission = contextSrv.hasAccess(AccessControlAction.PluginsInstall, isGrafanaAdmin());
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const isCompatible = Boolean(latestCompatibleVersion);

  if (plugin.type === PluginType.renderer) {
    return <div className={styles.message}>Renderer plugins cannot be managed by the Plugin Catalog.</div>;
  }

  if (plugin.type === PluginType.secretsmanager) {
    return <div className={styles.message}>Secrets manager plugins cannot be managed by the Plugin Catalog.</div>;
  }

  if (plugin.isEnterprise && !featureEnabled('enterprise.plugins')) {
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
    return <div className={styles.message}>{statusToMessage(pluginStatus)}</div>;
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

  if (!isRemotePluginsAvailable) {
    return (
      <div className={styles.message}>
        The install controls have been disabled because the Grafana server cannot access grafana.com.
      </div>
    );
  }

  return null;
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css`
      color: ${theme.colors.text.secondary};
    `,
  };
};

function statusToMessage(status: PluginStatus): string {
  switch (status) {
    case PluginStatus.INSTALL:
    case PluginStatus.REINSTALL:
      return `You do not have permission to install this plugin.`;
    case PluginStatus.UNINSTALL:
      return `You do not have permission to uninstall this plugin.`;
    case PluginStatus.UPDATE:
      return `You do not have permission to update this plugin.`;
    default:
      return `You do not have permission to manage this plugin.`;
  }
}
