import React, { useState } from 'react';
import { css } from 'emotion';
import { gt, satisfies } from 'semver';

import { config } from '@grafana/runtime';
import { Button, Icon, Select, stylesFactory, useTheme } from '@grafana/ui';

import { Metadata, Plugin } from '../types';
import { hasRole } from '../helpers';
import API from '../api';

// This isn't exported in the sdk yet
// @ts-ignore
import appEvents from 'grafana/app/core/app_events';
import { AppEvents, GrafanaTheme, OrgRole } from '@grafana/data';

interface Props {
  localPlugin?: Metadata;
  remotePlugin: Plugin;

  slug: string;
  pluginDir?: string;

  onRefresh: () => void;
}

export const InstallControls = ({ localPlugin, remotePlugin, slug, pluginDir, onRefresh }: Props) => {
  const [arch, setArch] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const theme = useTheme();
  const styles = getStyles(theme);

  const onInstall = (slug: string, version: string, pkg: string) => {
    setLoading(true);
    new API(pluginDir).installPlugin(slug, version, pkg).finally(() => {
      setLoading(false);
      onRefresh();
      appEvents.emit(AppEvents.alertSuccess, [`Installed ${remotePlugin?.name}`]);
    });
  };

  const onUninstall = () => {
    setLoading(true);
    new API(pluginDir).uninstallPlugin(slug).finally(() => {
      setLoading(false);
      onRefresh();
      appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${remotePlugin?.name}`]);
    });
  };

  const onUpdate = async () => {
    setLoading(true);

    const api = new API(pluginDir);
    await api.uninstallPlugin(slug);
    await api.installPlugin(slug, remotePlugin.version);

    setLoading(false);
    onRefresh();
    appEvents.emit(AppEvents.alertSuccess, [`Updated ${remotePlugin?.name}`]);
  };

  const isUpdateAvailable =
    remotePlugin?.version && localPlugin?.info.version && gt(remotePlugin?.version!, localPlugin?.info.version!);
  const grafanaDependency = remotePlugin?.json?.dependencies?.grafanaDependency;
  const unsupportedGrafanaVersion = grafanaDependency ? !satisfies(config.buildInfo.version, grafanaDependency) : false;

  const isDevelopmentBuild = !!localPlugin?.dev;
  const isEnterprise = remotePlugin?.status === 'enterprise';
  const isInternal = remotePlugin?.internal;
  const hasPackages = Object.keys(remotePlugin?.packages ?? {}).length > 1;
  const isInstalled = !!localPlugin;
  const hasPermission = hasRole(OrgRole.Admin);

  const archOptions = Object.values(remotePlugin?.packages ?? {}).map((_) => {
    const pair = _.packageName.split('-');

    if (pair.length === 2) {
      switch (pair[0]) {
        case 'windows':
          return { label: 'Windows', value: _.packageName };
        case 'linux':
          return { label: 'Linux', value: _.packageName };
        case 'darwin':
          return { label: 'macOS', value: _.packageName };
      }
    }

    return {
      label: _.packageName,
      value: _.packageName,
    };
  });

  if (isEnterprise) {
    return (
      <div className={styles.message}>
        Marketplace doesn&#39;t support installing Enterprise plugins yet. Stay tuned!
      </div>
    );
  }
  if (isInternal) {
    return <div className={styles.message}>This plugin is already included in Grafana.</div>;
  }
  if (isDevelopmentBuild) {
    return (
      <div className={styles.message}>This is a development build of the plugin and can&#39;t be uninstalled.</div>
    );
  }

  if (isInstalled) {
    return (
      <div className={styles.horizontalGroup}>
        {isUpdateAvailable && (
          <Button disabled={loading || !hasPermission} onClick={onUpdate}>
            {loading ? 'Updating' : 'Update'}
          </Button>
        )}
        <Button variant="destructive" disabled={loading || !hasPermission} onClick={onUninstall}>
          {loading ? 'Uninstalling' : 'Uninstall'}
        </Button>
        {!hasPermission && <div className={styles.message}>You need admin privileges to manage this plugin.</div>}
      </div>
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

  if (hasPackages) {
    return (
      <div className={styles.horizontalGroup}>
        <Select
          disabled={loading || !hasPermission}
          width={25}
          placeholder="Select your architecture"
          options={archOptions}
          onChange={(e) => {
            setArch(e.value);
          }}
        />
        {arch && (
          <Button disabled={loading || !hasPermission} onClick={() => onInstall(slug, remotePlugin.version, arch)}>
            {loading ? 'Installing' : 'Install'}
          </Button>
        )}
        {!hasPermission && <div className={styles.message}>You need admin privileges to install this plugin.</div>}
      </div>
    );
  }

  return (
    <div className={styles.horizontalGroup}>
      <Button disabled={loading || !hasPermission} onClick={() => onInstall(slug, remotePlugin.version, 'any')}>
        {loading ? 'Installing' : 'Install'}
      </Button>
      {!hasPermission && <div className={styles.message}>You need admin privileges to install this plugin.</div>}
    </div>
  );
};

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    message: css`
      color: ${theme.colors.textSemiWeak};
    `,
    horizontalGroup: css`
      display: flex;
      align-items: center;

      & > * {
        margin-right: ${theme.spacing.sm};
      }

      & > *:last-child {
        margin-right: 0;
      }
    `,
    readme: css`
      margin: ${theme.spacing.lg} 0;

      & img {
        max-width: 100%;
      }

      h1,
      h2,
      h3 {
        margin-top: ${theme.spacing.lg};
        margin-bottom: ${theme.spacing.md};
      }

      li {
        margin-left: ${theme.spacing.md};
        & > p {
          margin: ${theme.spacing.sm} 0;
        }
      }
    `,
  };
});
