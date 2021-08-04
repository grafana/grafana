import React from 'react';
import { css, cx } from '@emotion/css';
import { satisfies } from 'semver';

import { config } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { AppEvents, GrafanaTheme2 } from '@grafana/data';

import appEvents from 'app/core/app_events';
import { CatalogPluginDetails, ActionTypes } from '../types';
import { api } from '../api';
import { isGrafanaAdmin } from '../helpers';

interface Props {
  plugin: CatalogPluginDetails;
  isInflight: boolean;
  hasUpdate: boolean;
  hasInstalledPanel: boolean;
  isInstalled: boolean;
  dispatch: React.Dispatch<any>;
}

export const InstallControls = ({ plugin, isInflight, hasUpdate, isInstalled, hasInstalledPanel, dispatch }: Props) => {
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const externalManageLink = getExternalManageLink(plugin);

  const styles = useStyles2(getStyles);

  if (!plugin) {
    return null;
  }

  const onInstall = async () => {
    dispatch({ type: ActionTypes.INFLIGHT });
    try {
      await api.installPlugin(plugin.id, plugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Installed ${plugin.name}`]);
      dispatch({ type: ActionTypes.INSTALLED, payload: plugin.type === 'panel' });
    } catch (error) {
      dispatch({ type: ActionTypes.ERROR, payload: { error } });
    }
  };

  const onUninstall = async () => {
    dispatch({ type: ActionTypes.INFLIGHT });
    try {
      await api.uninstallPlugin(plugin.id);
      appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${plugin.name}`]);
      dispatch({ type: ActionTypes.UNINSTALLED });
    } catch (error) {
      dispatch({ type: ActionTypes.ERROR, payload: error });
    }
  };

  const onUpdate = async () => {
    dispatch({ type: ActionTypes.INFLIGHT });
    try {
      await api.installPlugin(plugin.id, plugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Updated ${plugin.name}`]);
      dispatch({ type: ActionTypes.UPDATED });
    } catch (error) {
      dispatch({ type: ActionTypes.ERROR, payload: error });
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

  if (!hasPermission && !isExternallyManaged) {
    const pluginStatus = isInstalled ? 'uninstall' : hasUpdate ? 'update' : 'install';
    const message = `You do not have permission to ${pluginStatus} this plugin.`;
    return <div className={styles.message}>{message}</div>;
  }

  if (isInstalled) {
    return (
      <HorizontalGroup height="auto">
        {hasUpdate &&
          (isExternallyManaged ? (
            <LinkButton href={externalManageLink} target="_blank" rel="noopener noreferrer">
              {'Update via grafana.com'}
            </LinkButton>
          ) : (
            <Button disabled={isInflight || !hasPermission} onClick={onUpdate}>
              {isInflight ? 'Updating' : 'Update'}
            </Button>
          ))}

        {isExternallyManaged ? (
          <LinkButton variant="destructive" href={externalManageLink} target="_blank" rel="noopener noreferrer">
            {'Uninstall via grafana.com'}
          </LinkButton>
        ) : (
          <>
            <Button variant="destructive" disabled={isInflight || !hasPermission} onClick={onUninstall}>
              {isInflight && !hasUpdate ? 'Uninstalling' : 'Uninstall'}
            </Button>
            {hasInstalledPanel && (
              <div className={cx(styles.message, styles.messageMargin)}>
                Please refresh your browser window before using this plugin.
              </div>
            )}
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
          <Button disabled={isInflight || !hasPermission} onClick={onInstall}>
            {isInflight ? 'Installing' : 'Install'}
          </Button>
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
