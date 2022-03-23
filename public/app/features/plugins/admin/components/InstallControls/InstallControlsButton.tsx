import React, { useState } from 'react';
import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, ConfirmModal } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { CatalogPlugin, PluginStatus, Version } from '../../types';
import { useInstallStatus, useUninstallStatus, useInstall, useUninstall } from '../../state/hooks';

type InstallControlsButtonProps = {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
  latestCompatibleVersion?: Version;
};

export function InstallControlsButton({ plugin, pluginStatus, latestCompatibleVersion }: InstallControlsButtonProps) {
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
        <HorizontalGroup height="auto">
          <Button variant="destructive" disabled={isUninstalling} onClick={showConfirmModal}>
            {uninstallBtnText}
          </Button>
        </HorizontalGroup>
      </>
    );
  }

  if (pluginStatus === PluginStatus.UPDATE) {
    return (
      <HorizontalGroup height="auto">
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
