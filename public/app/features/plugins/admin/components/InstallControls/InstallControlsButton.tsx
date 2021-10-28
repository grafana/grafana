import React, { useState, ReactElement } from 'react';
import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, ConfirmModal } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { CatalogPlugin, PluginStatus, Version } from '../../types';
import { useInstallStatus, useUninstallStatus, useInstall, useUninstall } from '../../state/hooks';
import { InstallVersionButton } from './InstallVersionButton';

type InstallControlsButtonProps = {
  plugin: CatalogPlugin;
  pluginStatus: PluginStatus;
};

export function InstallControlsButton({ plugin, pluginStatus }: InstallControlsButtonProps): ReactElement {
  const { isInstalling, error: errorInstalling } = useInstallStatus();
  const { isUninstalling, error: errorUninstalling } = useUninstallStatus();
  const install = useInstall();
  const uninstall = useUninstall();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [versionToInstall, setVersionToInstall] = useState(defaultVersionToInstall(plugin, pluginStatus));
  const showConfirmModal = () => setIsConfirmModalVisible(true);
  const hideConfirmModal = () => setIsConfirmModalVisible(false);
  const uninstallBtnText = isUninstalling ? 'Uninstalling' : 'Uninstall';

  const onInstall = async (version: Version) => {
    await install(plugin.id, version.version);
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

  const onUpdate = async (version: Version) => {
    await install(plugin.id, version.version, true);
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
        <InstallVersionButton
          version={versionToInstall}
          versions={plugin.details?.versions ?? []}
          disabled={isInstalling}
          onInstall={onUpdate}
          onChange={setVersionToInstall}
        >
          {isInstalling ? 'Updating' : `Update to v${versionToInstall.version}`}
        </InstallVersionButton>
        <Button variant="destructive" disabled={isUninstalling} onClick={onUninstall}>
          {uninstallBtnText}
        </Button>
      </HorizontalGroup>
    );
  }

  return (
    <InstallVersionButton
      version={versionToInstall}
      versions={plugin.details?.versions ?? []}
      disabled={isInstalling}
      onInstall={onInstall}
      onChange={setVersionToInstall}
    >
      {isInstalling ? 'Installing' : `Install v${versionToInstall.version}`}
    </InstallVersionButton>
  );
}

function defaultVersionToInstall(plugin: CatalogPlugin, pluginStatus: PluginStatus): Version {
  const defaultVersion: Version = {
    version: plugin.version,
    createdAt: plugin.updatedAt,
  };

  if (pluginStatus === PluginStatus.UPDATE) {
    return recommendedVersionToUpdateTo(plugin) ?? defaultVersion;
  }

  if (pluginStatus === PluginStatus.INSTALL) {
    return recommendedVersionToInstall(plugin) ?? defaultVersion;
  }

  return defaultVersion;
}

function recommendedVersionToInstall(plugin: CatalogPlugin): Version | undefined {
  const versions = plugin.details?.versions ?? [];
  return versions.find((v) => v.version === plugin.version);
}

function recommendedVersionToUpdateTo(plugin: CatalogPlugin): Version | undefined {
  const versions = plugin.details?.versions ?? [];
  return versions[0];
}
