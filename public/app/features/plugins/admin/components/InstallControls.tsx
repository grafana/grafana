import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { satisfies } from 'semver';

import { config } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { AppEvents, GrafanaTheme2 } from '@grafana/data';

import appEvents from 'app/core/app_events';
import { CatalogPluginDetails } from '../types';
import { api } from '../api';
import { isGrafanaAdmin } from '../helpers';

interface Props {
  plugin: CatalogPluginDetails;
}

export const InstallControls = ({ plugin }: Props) => {
  const [loading, setLoading] = useState(false);
  const [isInstalled, setIsInstalled] = useState(plugin.isInstalled || false);
  const [shouldUpdate, setShouldUpdate] = useState(plugin.hasUpdate || false);
  const [hasInstalledPanel, setHasInstalledPanel] = useState(false);
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const externalManageLink = getExternalManageLink(plugin);

  const styles = useStyles2(getStyles);

  if (!plugin) {
    return null;
  }

  const onInstall = async () => {
    setLoading(true);
    try {
      await api.installPlugin(plugin.id, plugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Installed ${plugin.name}`]);
      setLoading(false);
      setIsInstalled(true);
      setHasInstalledPanel(plugin.type === 'panel');
    } catch (error) {
      setLoading(false);
    }
  };

  const onUninstall = async () => {
    setLoading(true);
    try {
      await api.uninstallPlugin(plugin.id);
      appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${plugin.name}`]);
      setLoading(false);
      setIsInstalled(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const onUpdate = async () => {
    setLoading(true);
    try {
      await api.installPlugin(plugin.id, plugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Updated ${plugin.name}`]);
      setLoading(false);
      setShouldUpdate(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const grafanaDependency = plugin.grafanaDependency;
  const unsupportedGrafanaVersion = grafanaDependency
    ? !satisfies(config.buildInfo.version, grafanaDependency, {
        // needed for when running against master
        includePrerelease: true,
      })
    : false;

  const isDevelopmentBuild = Boolean(plugin.isDev);
  const isEnterprise = plugin.isEnterprise;
  const isCore = plugin.isCore;
  const hasPermission = isGrafanaAdmin();

  if (isCore) {
    return null;
  }

  if (isEnterprise && !config.licenseInfo?.hasValidLicense) {
    return (
      <div className={styles.message}>
        Marketplace doesn&#39;t support installing Enterprise plugins yet. Stay tuned!
      </div>
    );
  }

  if (isDevelopmentBuild) {
    return (
      <div className={styles.message}>This is a development build of the plugin and can&#39;t be uninstalled.</div>
    );
  }

  if (isInstalled) {
    return (
      <HorizontalGroup height="auto">
        {shouldUpdate &&
          (isExternallyManaged ? (
            <LinkButton href={externalManageLink} target="_blank" rel="noopener noreferrer">
              {'Update via grafana.com'}
            </LinkButton>
          ) : (
            <Button disabled={loading || !hasPermission} onClick={onUpdate}>
              {loading ? 'Updating' : 'Update'}
            </Button>
          ))}

        {isExternallyManaged ? (
          <LinkButton variant="destructive" href={externalManageLink} target="_blank" rel="noopener noreferrer">
            {'Uninstall via grafana.com'}
          </LinkButton>
        ) : (
          <>
            <Button variant="destructive" disabled={loading || !hasPermission} onClick={onUninstall}>
              {loading && !shouldUpdate ? 'Uninstalling' : 'Uninstall'}
            </Button>
            {hasInstalledPanel && (
              <div className={cx(styles.message, styles.messageMargin)}>
                Please refresh your browser window before using this plugin.
              </div>
            )}
            {!hasPermission && <div className={styles.message}>You need admin privileges to manage this plugin.</div>}
          </>
        )}
      </HorizontalGroup>
    );
  }

  if (unsupportedGrafanaVersion) {
    return (
      <div className={styles.message}>
        <Icon name="exclamation-triangle" />
        &nbsp;This plugin doesn&#39;t support your version of Grafana.
      </div>
    );
  }

  return (
    <HorizontalGroup height="auto">
      {isExternallyManaged ? (
        <LinkButton href={externalManageLink} target="_blank" rel="noopener noreferrer">
          {'Install via grafana.com'}
        </LinkButton>
      ) : (
        <>
          <Button disabled={loading || !hasPermission} onClick={onInstall}>
            {loading ? 'Installing' : 'Install'}
          </Button>
          {!hasPermission && <div className={styles.message}>You need admin privileges to install this plugin.</div>}
        </>
      )}
    </HorizontalGroup>
  );
};

function getExternalManageLink(plugin: CatalogPluginDetails): string {
  return `https://grafana.com/grafana/plugins/${plugin.id}`;
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css`
      color: ${theme.colors.text.secondary};
    `,
    messageMargin: css`
      margin-left: ${theme.spacing()};
    `,
  };
};
