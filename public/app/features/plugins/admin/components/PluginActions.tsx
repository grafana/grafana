import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HorizontalGroup, Icon, useStyles2, VerticalGroup } from '@grafana/ui';

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
    plugin.isCore || plugin.isDisabled || !isInstallControlsEnabled() || hasInstallWarning;

  return (
    <VerticalGroup>
      <HorizontalGroup>
        {!isInstallControlsDisabled && (
          <>
            {isExternallyManaged ? (
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
              />
            )}
          </>
        )}
        <GetStartedWithPlugin plugin={plugin} />
      </HorizontalGroup>
      {needReload && (
        <HorizontalGroup>
          <Icon name="exclamation-triangle" />
          <span className={styles.message}>Refresh the page to see the changes</span>
        </HorizontalGroup>
      )}
    </VerticalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    message: css`
      color: ${theme.colors.text.secondary};
    `,
  };
};
