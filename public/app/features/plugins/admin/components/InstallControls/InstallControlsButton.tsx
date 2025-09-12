import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, LinkButton, Stack } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { removePluginFromNavTree } from 'app/core/reducers/navBarTree';
import { isOpenSourceBuildOrUnlicenced } from 'app/features/admin/EnterpriseAuthFeaturesCard';
import { useDispatch } from 'app/types/store';

import { getExternalManageLink, isDisabledAngularPlugin } from '../../helpers';
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
    creator_team: 'grafana_plugins_catalog',
    schema_version: '1.0.0',
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
      if (config.pluginAdminExternalManageEnabled) {
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
      if (config.pluginAdminExternalManageEnabled) {
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
    reportInteraction(PLUGIN_UPDATE_INTERACTION_EVENT_NAME, trackingProps);

    await install(plugin.id, latestCompatibleVersion?.version, PluginStatus.UPDATE);
    if (!errorInstalling) {
      appEvents.emit(AppEvents.alertSuccess, [`Updated ${plugin.name}`]);
    }
  };

  let disableUninstall = shouldDisableUninstall(isUninstalling, plugin) ?? false;
  const uninstallTooltip = isDisabledAngularPlugin(plugin)
    ? 'To uninstall this plugin, upgrade to a compatible version first, then uninstall it.'
    : '';

  let uninstallTitle = '';
  if (plugin.isPreinstalled.found) {
    disableUninstall = true;
    uninstallTitle = 'Preinstalled plugin. Remove from Grafana config before uninstalling.';
  }

  const uninstallControls = (
    <>
      <ConfirmModal
        isOpen={isConfirmModalVisible}
        title={t('plugins.install-controls-button.title-uninstall-modal', 'Uninstall {{plugin}}', {
          plugin: plugin.name,
        })}
        body={t(
          'plugins.install-controls-button.uninstall-controls.body-uninstall-plugin',
          'Are you sure you want to uninstall this plugin?'
        )}
        confirmText={t('plugins.install-controls-button.uninstall-controls.confirmText-confirm', 'Confirm')}
        icon="exclamation-triangle"
        onConfirm={onUninstall}
        onDismiss={hideConfirmModal}
      />
      <Button
        variant="destructive"
        disabled={disableUninstall}
        onClick={showConfirmModal}
        title={uninstallTitle}
        tooltip={uninstallTooltip}
      >
        {uninstallBtnText}
      </Button>
    </>
  );

  if (pluginStatus === PluginStatus.UNINSTALL) {
    return (
      <Stack alignItems="flex-start" width="auto" height="auto">
        {uninstallControls}
      </Stack>
    );
  }


  // Show learn more button for an enterprise plugin if your on OSS
  if (plugin.isEnterprise && isOpenSourceBuildOrUnlicenced()) {
    return (
      <LinkButton
        href={`${getExternalManageLink(plugin.id)}?utm_source=grafana_catalog_learn_more`}
        target="_blank"
        rel="noopener noreferrer"
        icon="external-link-alt"
      >
        <Trans i18nKey="plugins.install-controls-warning.learn-more">Learn more</Trans>
      </LinkButton>
    );
  }

  if (!plugin.isPublished || hasInstallWarning) {
    // Cannot be updated or installed
    return null;
  }

  if (pluginStatus === PluginStatus.UPDATE) {
    const disableUpdate = config.pluginAdminExternalManageEnabled ? plugin.isUpdatingFromInstance : isInstalling;

    return (
      <Stack alignItems="flex-start" width="auto" height="auto">
        {!plugin.isManaged && !plugin.isPreinstalled.withVersion && (
          <Button disabled={disableUpdate} onClick={onUpdate}>
            {isInstalling
              ? t('plugins.install-controls.updating', 'Updating')
              : t('plugins.install-controls.update', 'Update')}
          </Button>
        )}
        {uninstallControls}
      </Stack>
    );
  }

  const shouldDisable = isInstalling || errorInstalling || plugin.angularDetected;

  return (
    <Button disabled={shouldDisable} onClick={onInstall}>
      {isInstalling
        ? t('plugins.install-controls.installing', 'Installing')
        : t('plugins.install-controls.install', 'Install')}
    </Button>
  );
}

function shouldDisableUninstall(isUninstalling: boolean, plugin: CatalogPlugin) {
  if (isDisabledAngularPlugin(plugin)) {
    return true;
  }

  if (config.pluginAdminExternalManageEnabled) {
    return plugin.isUninstallingFromInstance || !plugin.isFullyInstalled || plugin.isUpdatingFromInstance;
  }

  return isUninstalling;
}
