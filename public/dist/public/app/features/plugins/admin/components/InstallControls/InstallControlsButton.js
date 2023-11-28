import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppEvents } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, ConfirmModal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { removePluginFromNavTree } from 'app/core/reducers/navBarTree';
import { useDispatch } from 'app/types';
import { useInstallStatus, useUninstallStatus, useInstall, useUninstall, useUnsetInstall, useFetchDetailsLazy, } from '../../state/hooks';
import { trackPluginInstalled, trackPluginUninstalled } from '../../tracking';
import { PluginStatus, PluginTabIds } from '../../types';
export function InstallControlsButton({ plugin, pluginStatus, latestCompatibleVersion, hasInstallWarning, setNeedReload, }) {
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
    const onInstall = () => __awaiter(this, void 0, void 0, function* () {
        trackPluginInstalled(trackingProps);
        const result = yield install(plugin.id, latestCompatibleVersion === null || latestCompatibleVersion === void 0 ? void 0 : latestCompatibleVersion.version);
        // refresh the store to have the new installed plugin
        yield fetchDetails(plugin.id);
        if (!errorInstalling && !('error' in result)) {
            appEvents.emit(AppEvents.alertSuccess, [`Installed ${plugin.name}`]);
            if (plugin.type === 'app') {
                setNeedReload === null || setNeedReload === void 0 ? void 0 : setNeedReload(true);
            }
        }
    });
    const onUninstall = () => __awaiter(this, void 0, void 0, function* () {
        hideConfirmModal();
        trackPluginUninstalled(trackingProps);
        yield uninstall(plugin.id);
        if (!errorUninstalling) {
            // If an app plugin is uninstalled we need to reset the active tab when the config / dashboards tabs are removed.
            const activePageId = queryParams.page;
            const isViewingAppConfigPage = activePageId !== PluginTabIds.OVERVIEW && activePageId !== PluginTabIds.VERSIONS;
            if (isViewingAppConfigPage) {
                locationService.replace(`${location.pathname}?page=${PluginTabIds.OVERVIEW}`);
            }
            appEvents.emit(AppEvents.alertSuccess, [`Uninstalled ${plugin.name}`]);
            if (plugin.type === 'app') {
                dispatch(removePluginFromNavTree({ pluginID: plugin.id }));
                setNeedReload === null || setNeedReload === void 0 ? void 0 : setNeedReload(false);
            }
        }
    });
    const onUpdate = () => __awaiter(this, void 0, void 0, function* () {
        yield install(plugin.id, latestCompatibleVersion === null || latestCompatibleVersion === void 0 ? void 0 : latestCompatibleVersion.version, true);
        if (!errorInstalling) {
            appEvents.emit(AppEvents.alertSuccess, [`Updated ${plugin.name}`]);
        }
    });
    if (pluginStatus === PluginStatus.UNINSTALL) {
        return (React.createElement(React.Fragment, null,
            React.createElement(ConfirmModal, { isOpen: isConfirmModalVisible, title: `Uninstall ${plugin.name}`, body: "Are you sure you want to uninstall this plugin?", confirmText: "Confirm", icon: "exclamation-triangle", onConfirm: onUninstall, onDismiss: hideConfirmModal }),
            React.createElement(HorizontalGroup, { align: "flex-start", width: "auto", height: "auto" },
                React.createElement(Button, { variant: "destructive", disabled: isUninstalling, onClick: showConfirmModal }, uninstallBtnText))));
    }
    if (!plugin.isPublished || hasInstallWarning) {
        // Cannot be updated or installed
        return null;
    }
    if (pluginStatus === PluginStatus.UPDATE) {
        return (React.createElement(HorizontalGroup, { align: "flex-start", width: "auto", height: "auto" },
            React.createElement(Button, { disabled: isInstalling, onClick: onUpdate }, isInstalling ? 'Updating' : 'Update'),
            React.createElement(Button, { variant: "destructive", disabled: isUninstalling, onClick: onUninstall }, uninstallBtnText)));
    }
    const shouldDisable = isInstalling || errorInstalling || (!config.angularSupportEnabled && plugin.angularDetected);
    return (React.createElement(Button, { disabled: shouldDisable, onClick: onInstall }, isInstalling ? 'Installing' : 'Install'));
}
//# sourceMappingURL=InstallControlsButton.js.map