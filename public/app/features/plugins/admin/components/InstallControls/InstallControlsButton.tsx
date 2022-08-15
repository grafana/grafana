import React, { useState } from 'react';

import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, ConfirmModal } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { useInstall, useUninstall } from '../../state/hooks';
import { CatalogPlugin, PluginStatus, Version } from '../../types';

type InstallControlsButtonProps = {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
  latestCompatibleVersion?: Version;
};

export function InstallControlsButton({ plugin, pluginStatus, latestCompatibleVersion }: InstallControlsButtonProps) {
  const { install, error: installError, loading: installLoading } = useInstall();
  const { uninstall, error: uninstallError, loading: uninstallLoading } = useUninstall();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const showConfirmModal = () => setIsConfirmModalVisible(true);
  const hideConfirmModal = () => setIsConfirmModalVisible(false);
  const uninstallBtnText = uninstallLoading ? 'Uninstalling' : 'Uninstall';

  const onInstall = async () => {
    await install(plugin.id, latestCompatibleVersion?.version);
    if (!installError) {
      appEvents.emit(AppEvents.alertSuccess, [`Installed ${plugin.name}`]);
    }
  };

  const onUninstall = async () => {
    hideConfirmModal();
    await uninstall(plugin.id);
    if (!uninstallError) {
      appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${plugin.name}`]);
    }
  };

  const onUpdate = async () => {
    await install(plugin.id, latestCompatibleVersion?.version, true);
    if (!installError) {
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
          <Button variant="destructive" disabled={uninstallLoading} onClick={showConfirmModal}>
            {uninstallBtnText}
          </Button>
        </HorizontalGroup>
      </>
    );
  }

  if (pluginStatus === PluginStatus.UPDATE) {
    return (
      <HorizontalGroup height="auto">
        <Button disabled={installLoading} onClick={onUpdate}>
          {installLoading ? 'Updating' : 'Update'}
        </Button>
        <Button variant="destructive" disabled={uninstallLoading} onClick={onUninstall}>
          {uninstallBtnText}
        </Button>
      </HorizontalGroup>
    );
  }

  return (
    <Button disabled={installLoading} onClick={onInstall}>
      {installLoading ? 'Installing' : 'Install'}
    </Button>
  );
}
