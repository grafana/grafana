import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';

import { InstallControlsWarning } from '../components/InstallControls';
import { getLatestCompatibleVersion, hasInstallControlWarning } from '../helpers';
import { useInstallStatus, useIsRemotePluginsAvailable } from '../state/hooks';
import { CatalogPlugin, PluginStatus } from '../types';

interface Props {
  plugin?: CatalogPlugin;
}

export const PluginSubtitle = ({ plugin }: Props) => {
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const styles = useStyles2(getStyles);
  const { error: errorInstalling } = useInstallStatus();
  if (!plugin) {
    return null;
  }
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin.details?.versions);
  const pluginStatus = plugin.isInstalled
    ? plugin.hasUpdate
      ? PluginStatus.UPDATE
      : PluginStatus.UNINSTALL
    : PluginStatus.INSTALL;

  return (
    <div className={styles.subtitle}>
      {errorInstalling && (
        <Alert title={'message' in errorInstalling ? errorInstalling.message : ''}>
          {typeof errorInstalling === 'string' ? errorInstalling : errorInstalling.error}
        </Alert>
      )}
      {plugin?.description && <div>{plugin?.description}</div>}
      {plugin?.details?.links && plugin.details.links.length > 0 && (
        <span>
          {plugin.details.links.map((link, index) => (
            <React.Fragment key={index}>
              {index > 0 && ' | '}
              <a href={link.url} className="external-link">
                {link.name}
              </a>
            </React.Fragment>
          ))}
        </span>
      )}
      {hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion) && (
        <InstallControlsWarning
          plugin={plugin}
          pluginStatus={pluginStatus}
          latestCompatibleVersion={latestCompatibleVersion}
        />
      )}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    subtitle: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
  };
};
