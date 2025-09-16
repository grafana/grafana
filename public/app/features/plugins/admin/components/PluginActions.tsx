import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, PluginErrorCode } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

import { GetStartedWithPlugin } from '../components/GetStartedWithPlugin';
import { InstallControlsButton } from '../components/InstallControls/InstallControlsButton';
import {
  getLatestCompatibleVersion,
  hasInstallControlWarning,
  isDisabledAngularPlugin,
  isInstallControlsEnabled,
  isNonAngularVersion,
} from '../helpers';
import { useIsRemotePluginsAvailable } from '../state/hooks';
import { CatalogPlugin, PluginStatus, Version } from '../types';

interface Props {
  plugin?: CatalogPlugin;
}

export const PluginActions = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
  const latestCompatibleVersion = getLatestCompatibleVersion(plugin?.details?.versions);
  const [needReload, setNeedReload] = useState(false);

  if (!plugin || plugin.angularDetected) {
    return null;
  }

  const hasInstallWarning = hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion);
  const pluginStatus = getPluginStatus(plugin, latestCompatibleVersion);
  const isInstallControlsDisabled = getInstallControlsDisabled(plugin, latestCompatibleVersion);

  return (
    <Stack direction="column">
      <Stack alignItems="center">
        {!isInstallControlsDisabled && (
          <InstallControlsButton
            plugin={plugin}
            latestCompatibleVersion={latestCompatibleVersion}
            pluginStatus={pluginStatus}
            setNeedReload={setNeedReload}
            hasInstallWarning={hasInstallWarning}
          />
        )}
        <GetStartedWithPlugin plugin={plugin} />
      </Stack>
      {needReload && (
        <Stack alignItems="center">
          <Icon name="exclamation-triangle" />
          <span className={styles.message}>
            <Trans i18nKey="plugins.plugin-actions.refresh-changes">Refresh the page to see the changes</Trans>
          </span>
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

function getAngularPluginStatus(plugin: CatalogPlugin, latestCompatibleVersion: Version | undefined): PluginStatus {
  if (!plugin.isInstalled) {
    return PluginStatus.INSTALL;
  }

  if (isNonAngularVersion(latestCompatibleVersion)) {
    return PluginStatus.UPDATE;
  }

  return PluginStatus.UNINSTALL;
}

function getPluginStatus(plugin: CatalogPlugin, latestCompatibleVersion: Version | undefined) {
  if (plugin.error === PluginErrorCode.angular) {
    return getAngularPluginStatus(plugin, latestCompatibleVersion);
  }

  if (!plugin.isInstalled) {
    return PluginStatus.INSTALL;
  }

  if (plugin.hasUpdate) {
    return PluginStatus.UPDATE;
  }

  return PluginStatus.UNINSTALL;
}

function getInstallControlsDisabled(plugin: CatalogPlugin, latestCompatibleVersion: Version | undefined) {
  if (isDisabledAngularPlugin(plugin) && isNonAngularVersion(latestCompatibleVersion)) {
    return false;
  }

  return plugin.isCore || plugin.isDisabled || plugin.isProvisioned || !isInstallControlsEnabled();
}

export { getPluginStatus, getInstallControlsDisabled };
