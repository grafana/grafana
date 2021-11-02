import { __awaiter, __generator, __read } from "tslib";
import React, { useState } from 'react';
import { AppEvents } from '@grafana/data';
import { Button, HorizontalGroup, ConfirmModal } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { PluginStatus } from '../../types';
import { useInstallStatus, useUninstallStatus, useInstall, useUninstall } from '../../state/hooks';
export function InstallControlsButton(_a) {
    var _this = this;
    var plugin = _a.plugin, pluginStatus = _a.pluginStatus;
    var _b = useInstallStatus(), isInstalling = _b.isInstalling, errorInstalling = _b.error;
    var _c = useUninstallStatus(), isUninstalling = _c.isUninstalling, errorUninstalling = _c.error;
    var install = useInstall();
    var uninstall = useUninstall();
    var _d = __read(useState(false), 2), isConfirmModalVisible = _d[0], setIsConfirmModalVisible = _d[1];
    var showConfirmModal = function () { return setIsConfirmModalVisible(true); };
    var hideConfirmModal = function () { return setIsConfirmModalVisible(false); };
    var uninstallBtnText = isUninstalling ? 'Uninstalling' : 'Uninstall';
    var onInstall = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, install(plugin.id, plugin.version)];
                case 1:
                    _a.sent();
                    if (!errorInstalling) {
                        appEvents.emit(AppEvents.alertSuccess, ["Installed " + plugin.name]);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var onUninstall = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    hideConfirmModal();
                    return [4 /*yield*/, uninstall(plugin.id)];
                case 1:
                    _a.sent();
                    if (!errorUninstalling) {
                        appEvents.emit(AppEvents.alertSuccess, ["Uninstalled " + plugin.name]);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var onUpdate = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, install(plugin.id, plugin.version, true)];
                case 1:
                    _a.sent();
                    if (!errorInstalling) {
                        appEvents.emit(AppEvents.alertSuccess, ["Updated " + plugin.name]);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    if (pluginStatus === PluginStatus.UNINSTALL) {
        return (React.createElement(React.Fragment, null,
            React.createElement(ConfirmModal, { isOpen: isConfirmModalVisible, title: "Uninstall " + plugin.name, body: "Are you sure you want to uninstall this plugin?", confirmText: "Confirm", icon: "exclamation-triangle", onConfirm: onUninstall, onDismiss: hideConfirmModal }),
            React.createElement(HorizontalGroup, { height: "auto" },
                React.createElement(Button, { variant: "destructive", disabled: isUninstalling, onClick: showConfirmModal }, uninstallBtnText))));
    }
    if (pluginStatus === PluginStatus.UPDATE) {
        return (React.createElement(HorizontalGroup, { height: "auto" },
            React.createElement(Button, { disabled: isInstalling, onClick: onUpdate }, isInstalling ? 'Updating' : 'Update'),
            React.createElement(Button, { variant: "destructive", disabled: isUninstalling, onClick: onUninstall }, uninstallBtnText)));
    }
    return (React.createElement(Button, { disabled: isInstalling, onClick: onInstall }, isInstalling ? 'Installing' : 'Install'));
}
//# sourceMappingURL=InstallControlsButton.js.map