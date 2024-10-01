import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, Stack } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import configCore from 'app/core/config';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { removePluginFromNavTree } from 'app/core/reducers/navBarTree';
import { useDispatch } from 'app/types';

import {
  useInstallStatus,
  useUninstallStatus,
  useInstall,
  useUninstall,
  useUnsetInstall,
  useFetchDetailsLazy,
} from '../../state/hooks';
import { trackPluginInstalled, trackPluginUninstalled } from '../../tracking';
import { CatalogPlugin, PluginStatus, PluginTabIds, Version } from '../../types';

const PLUGIN_UPDATE_INTERACTION_EVENT_NAME = 'plugin_update_clicked';

type InstallControlsButtonProps = {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
  latestCompatibleVersion?: Version;
  hasInstallWarning?: boolean;
  setNeedReload?: (needReload: boolean) => void;
};

export function InstallControlsButton({
  plugin,
  pluginStatus,
  latestCompatibleVersion,
  hasInstallWarning,
  setNeedReload,
}: InstallControlsButtonProps) {
  const dispatch = useDispatch();
  const [queryParams] = useQueryParams();
  const location = useLocation();
  const { isInstalling, error: errorInstalling } = useInstallStatus();
  const { isUninstalling, error: errorUninstalling } = useUninstallStatus();
  const install = useInstall();
  const uninstall = useUninstall();
  const unsetInstall = useUnsetInstall();
  const fetchDetails = useFetchDetailsLazy();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const showConfirmModal = () => setIsConfirmModalVisible(true);
  const hideConfirmModal = () => setIsConfirmModalVisible(false);
  const uninstallBtnText = isUninstalling ? 'Uninstalling' : 'Uninstall';
  const trackingProps = {
    plugin_id: plugin.id,
    plugin_type: plugin.type,
    path: location.pathname,
  };

  useEffect(() => {
    return () => {
      // Remove possible installation errors
      unsetInstall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInstall = async () => {
    trackPluginInstalled(trackingProps);
    const result = await install(plugin.id, latestCompatibleVersion?.version);
    if (!errorInstalling && !('error' in result)) {
      let successMessage = `Installed ${plugin.name}`;
      if (config.pluginAdminExternalManageEnabled && configCore.featureToggles.managedPluginsInstall) {
        successMessage = 'Install requested, this may take a few minutes.';
      }

      appEvents.emit(AppEvents.alertSuccess, [successMessage]);
      if (plugin.type === 'app') {
        setNeedReload?.(true);
      }

      await fetchDetails(plugin.id);
    }
  };

  const onUninstall = async () => {
    hideConfirmModal();
    trackPluginUninstalled(trackingProps);
    await uninstall(plugin.id);
    if (!errorUninstalling) {
      // If an app plugin is uninstalled we need to reset the active tab when the config / dashboards tabs are removed.
      const activePageId = queryParams.page;
      const isViewingAppConfigPage = activePageId !== PluginTabIds.OVERVIEW && activePageId !== PluginTabIds.VERSIONS;
      if (isViewingAppConfigPage) {
        locationService.replace(`${location.pathname}?page=${PluginTabIds.OVERVIEW}`);
      }

      let successMessage = `Uninstalled ${plugin.name}`;
      if (config.pluginAdminExternalManageEnabled && configCore.featureToggles.managedPluginsInstall) {
        successMessage = 'Uninstall requested, this may take a few minutes.';
      }

      appEvents.emit(AppEvents.alertSuccess, [successMessage]);
      if (plugin.type === 'app') {
        dispatch(removePluginFromNavTree({ pluginID: plugin.id }));
        setNeedReload?.(false);
      }
    }
  };

  const onUpdate = async () => {
    reportInteraction(PLUGIN_UPDATE_INTERACTION_EVENT_NAME);

    await install(plugin.id, latestCompatibleVersion?.version, true);
    if (!errorInstalling) {
      appEvents.emit(AppEvents.alertSuccess, [`Updated ${plugin.name}`]);
    }
  };

  let disableUninstall =
    config.pluginAdminExternalManageEnabled && configCore.featureToggles.managedPluginsInstall
      ? plugin.isUninstallingFromInstance
      : isUninstalling;
  let uninstallTitle = '';
  if (plugin.isPreinstalled.found) {
    disableUninstall = true;
    uninstallTitle = 'Preinstalled plugin. Remove from Grafana config before uninstalling.';
  }

  if (pluginStatus === PluginStatus.UNINSTALL) {
    return (
      <>
        <ConfirmModal
          isOpen={isConfirmModalVisible}
          title={`Uninstall ${plugin.name}`}
          body="Are you sure you want to uninstall this plugin?"
          confirmText="Confirm"
          icon="exclamation-triangle"
          onConfirm={onUninstall}
          onDismiss={hideConfirmModal}
        />
        <Stack alignItems="flex-start" width="auto" height="auto">
          <Button variant="destructive" disabled={disableUninstall} onClick={showConfirmModal} title={uninstallTitle}>
            {uninstallBtnText}
          </Button>
        </Stack>
      </>
    );
  }

  if (!plugin.isPublished || hasInstallWarning) {
    // Cannot be updated or installed
    return null;
  }

  if (pluginStatus === PluginStatus.UPDATE) {
    const disableUpdate =
      config.pluginAdminExternalManageEnabled && configCore.featureToggles.managedPluginsInstall
        ? plugin.isUpdatingFromInstance
        : isInstalling;

    return (
      <Stack alignItems="flex-start" width="auto" height="auto">
        {!plugin.isManaged && !plugin.isPreinstalled.withVersion && (
          <Button disabled={disableUpdate} onClick={onUpdate}>
            {isInstalling ? 'Updating' : 'Update'}
          </Button>
        )}
        <Button variant="destructive" disabled={disableUninstall} onClick={onUninstall} title={uninstallTitle}>
          {uninstallBtnText}
        </Button>
      </Stack>
    );
  }
  const shouldDisable = isInstalling || errorInstalling || (!config.angularSupportEnabled && plugin.angularDetected);
  return (
    <Button disabled={shouldDisable} onClick={onInstall}>
      {isInstalling ? 'Installing' : 'Install'}
    </Button>
  );
}
