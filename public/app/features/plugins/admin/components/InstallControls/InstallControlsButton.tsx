import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, ConfirmModal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { useInstallStatus, useUninstallStatus, useInstall, useUninstall } from '../../state/hooks';
import { CatalogPlugin, PluginStatus, PluginTabIds, Version } from '../../types';

type InstallControlsButtonProps = {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
  latestCompatibleVersion?: Version;
};

export function InstallControlsButton({ plugin, pluginStatus, latestCompatibleVersion }: InstallControlsButtonProps) {
  const [queryParams] = useQueryParams();
  const location = useLocation();
  const { isInstalling, error: errorInstalling } = useInstallStatus();
  const { isUninstalling, error: errorUninstalling } = useUninstallStatus();
  const install = useInstall();
  const uninstall = useUninstall();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const showConfirmModal = () => setIsConfirmModalVisible(true);
  const hideConfirmModal = () => setIsConfirmModalVisible(false);
  const uninstallBtnText = isUninstalling ? 'Uninstalling' : 'Uninstall';

  const onInstall = async () => {
    await install(plugin.id, latestCompatibleVersion?.version);
    if (!errorInstalling) {
      appEvents.emit(AppEvents.alertSuccess, [`Installed ${plugin.name}`]);
    }
  };

  const onUninstall = async () => {
    hideConfirmModal();
    await uninstall(plugin.id);
    if (!errorUninstalling) {
      // If an app plugin is uninstalled we need to reset the active tab when the config / dashboards tabs are removed.
      const activePageId = queryParams.page;
      const isViewingAppConfigPage = activePageId !== PluginTabIds.OVERVIEW && activePageId !== PluginTabIds.VERSIONS;
      if (isViewingAppConfigPage) {
        locationService.replace(`${location.pathname}?page=${PluginTabIds.OVERVIEW}`);
      }
      appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${plugin.name}`]);
    }
  };

  const onUpdate = async () => {
    await install(plugin.id, latestCompatibleVersion?.version, true);
    if (!errorInstalling) {
      appEvents.emit(AppEvents.alertSuccess, [`Updated ${plugin.name}`]);
    }
  };

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
        <HorizontalGroup align="flex-start" width="auto" height="auto">
          <Button variant="destructive" disabled={isUninstalling} onClick={showConfirmModal}>
            {uninstallBtnText}
          </Button>
        </HorizontalGroup>
      </>
    );
  }

  if (pluginStatus === PluginStatus.UPDATE) {
    return (
      <HorizontalGroup align="flex-start" width="auto" height="auto">
        <Button disabled={isInstalling} onClick={onUpdate}>
          {isInstalling ? 'Updating' : 'Update'}
        </Button>
        <Button variant="destructive" disabled={isUninstalling} onClick={onUninstall}>
          {uninstallBtnText}
        </Button>
      </HorizontalGroup>
    );
  }

  return (
    <Button disabled={isInstalling} onClick={onInstall}>
      {isInstalling ? 'Installing' : 'Install'}
    </Button>
  );
}
