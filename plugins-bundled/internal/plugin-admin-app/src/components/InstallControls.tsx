import React, { useState } from 'react';
import { css } from '@emotion/css';
import { gt, satisfies } from 'semver';

import { config } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { AppEvents, GrafanaTheme2 } from '@grafana/data';

import { Metadata, Plugin } from '../types';
import { api } from '../api';

// This isn't exported in the sdk yet
// @ts-ignore
import appEvents from 'grafana/app/core/app_events';
import { isGrafanaAdmin } from '../helpers';

interface Props {
  localPlugin?: Metadata;
  remotePlugin: Plugin;
}

export const InstallControls = ({ localPlugin, remotePlugin }: Props) => {
  const [loading, setLoading] = useState(false);
  const [isInstalled, setIsInstalled] = useState(Boolean(localPlugin));
  const [shouldUpdate, setShouldUpdate] = useState(
    remotePlugin?.version && localPlugin?.info.version && gt(remotePlugin?.version!, localPlugin?.info.version!)
  );
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const externalManageLink = getExternalManageLink(remotePlugin);

  const styles = useStyles2(getStyles);

  const onInstall = async () => {
    setLoading(true);
    try {
      await api.installPlugin(remotePlugin.slug, remotePlugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Installed ${remotePlugin?.name}`]);
      setLoading(false);
      setIsInstalled(true);
    } catch (error) {
      setLoading(false);
    }
  };

  const onUninstall = async () => {
    setLoading(true);
    try {
      await api.uninstallPlugin(remotePlugin.slug);
      appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${remotePlugin?.name}`]);
      setLoading(false);
      setIsInstalled(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const onUpdate = async () => {
    setLoading(true);
    try {
      await api.installPlugin(remotePlugin.slug, remotePlugin.version);
      appEvents.emit(AppEvents.alertSuccess, [`Updated ${remotePlugin?.name}`]);
      setLoading(false);
      setShouldUpdate(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const grafanaDependency = remotePlugin?.json?.dependencies?.grafanaDependency;
  const unsupportedGrafanaVersion = grafanaDependency
    ? !satisfies(config.buildInfo.version, grafanaDependency, {
        // needed for when running against master
        includePrerelease: true,
      })
    : false;

  const isDevelopmentBuild = Boolean(localPlugin?.dev);
  const isEnterprise = remotePlugin?.status === 'enterprise';
  const hasPermission = isGrafanaAdmin();

  if (isEnterprise) {
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

function getExternalManageLink(plugin: Plugin): string {
  return `https://grafana.com/grafana/plugins/${plugin.slug}`;
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css`
      color: ${theme.colors.text.secondary};
    `,
    readme: css`
      margin: ${theme.spacing(3)} 0;

      & img {
        max-width: 100%;
      }

      h1,
      h2,
      h3 {
        margin-top: ${theme.spacing(3)};
        margin-bottom: ${theme.spacing(2)};
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
