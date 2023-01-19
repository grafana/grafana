import React from 'react';

import { config } from '@grafana/runtime';

import { GetStartedWithPlugin } from '../components/GetStartedWithPlugin';
import { InstallControlsButton } from '../components/InstallControls';
import { ExternallyManagedButton } from '../components/InstallControls/ExternallyManagedButton';
import { getLatestCompatibleVersion, hasInstallControlWarning, isInstallControlsEnabled } from '../helpers';
import { useIsRemotePluginsAvailable } from '../state/hooks';
import { CatalogPlugin, PluginStatus } from '../types';

interface Props {
  plugin?: CatalogPlugin;
}

export const PluginActions = ({ plugin }: Props) => {
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin?.details?.versions);

  if (!plugin) {
    return null;
  }

  const hasInstallWarning = hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion);
  const isExternallyManaged = config.pluginAdminExternalManageEnabled;
  const pluginStatus = plugin.isInstalled
    ? plugin.hasUpdate
      ? PluginStatus.UPDATE
      : PluginStatus.UNINSTALL
    : PluginStatus.INSTALL;
  const isInstallControlsDisabled =
    plugin.isCore || plugin.isDisabled || !isInstallControlsEnabled() || hasInstallWarning;

  return (
    <>
      {!isInstallControlsDisabled && (
        <>
          {isExternallyManaged ? (
            <ExternallyManagedButton pluginId={plugin.id} pluginStatus={pluginStatus} />
          ) : (
            <InstallControlsButton
              plugin={plugin}
              latestCompatibleVersion={latestCompatibleVersion}
              pluginStatus={pluginStatus}
            />
          )}
        </>
      )}
      <GetStartedWithPlugin plugin={plugin} />
    </>
  );
};
