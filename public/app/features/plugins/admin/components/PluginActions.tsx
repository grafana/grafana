import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, Stack, useStyles2 } from '@grafana/ui';
import configCore from 'app/core/config';

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
  const styles = useStyles2(getStyles);
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin?.details?.versions);
  const [needReload, setNeedReload] = useState(false);

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
    plugin.isCore || plugin.isDisabled || plugin.isProvisioned || !isInstallControlsEnabled();

  return (
    <Stack direction="column">
      <Stack alignItems="center">
        {!isInstallControlsDisabled && (
          <>
            {isExternallyManaged && !hasInstallWarning && !configCore.featureToggles.managedPluginsInstall ? (
              <ExternallyManagedButton
                pluginId={plugin.id}
                pluginStatus={pluginStatus}
                angularDetected={plugin.angularDetected}
              />
            ) : (
              <InstallControlsButton
                plugin={plugin}
                latestCompatibleVersion={latestCompatibleVersion}
                pluginStatus={pluginStatus}
                setNeedReload={setNeedReload}
                hasInstallWarning={hasInstallWarning}
              />
            )}
          </>
        )}
        <GetStartedWithPlugin plugin={plugin} />
      </Stack>
      {needReload && (
        <Stack alignItems="center">
          <Icon name="exclamation-triangle" />
          <span className={styles.message}>Refresh the page to see the changes</span>
        </Stack>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css({
      color: theme.colors.text.secondary,
    }),
  };
};
