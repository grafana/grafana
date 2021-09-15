import React, { useState } from 'react';
import { useMountedState } from 'react-use';
import { AppEvents, PluginType } from '@grafana/data';
import { Button, HorizontalGroup, ConfirmModal, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { CatalogPlugin, PluginStatus } from '../../types';
import { getStyles } from './index';
import { useInstallStatus, useUninstallStatus, useInstall, useUninstall } from '../../state/hooks';

type InstallControlsButtonProps = {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
};

export function InstallControlsButton({ plugin, pluginStatus }: InstallControlsButtonProps) {
  const { isInstalling, error: errorInstalling } = useInstallStatus();
  const { isUninstalling, error: errorUninstalling } = useUninstallStatus();
  const install = useInstall();
  const uninstall = useUninstall();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const showConfirmModal = () => setIsConfirmModalVisible(true);
  const hideConfirmModal = () => setIsConfirmModalVisible(false);
  const [hasInstalledPanel, setHasInstalledPanel] = useState(false);
  const styles = useStyles2(getStyles);
  const uninstallBtnText = isUninstalling ? 'Uninstalling' : 'Uninstall';
  const isMounted = useMountedState();

  const onInstall = async () => {
    await install(plugin.id, plugin.version);
    if (!errorInstalling) {
      if (isMounted() && plugin.type === PluginType.panel) {
        setHasInstalledPanel(true);
      }
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
    await install(plugin.id, plugin.version, true);
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
          {hasInstalledPanel && (
            <div className={styles.message}>Please refresh your browser window before using this plugin.</div>
          )}
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
