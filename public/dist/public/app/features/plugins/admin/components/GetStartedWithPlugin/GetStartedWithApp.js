import { __awaiter } from "tslib";
import React from 'react';
import { Button } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { updatePluginSettings } from '../../api';
import { usePluginConfig } from '../../hooks/usePluginConfig';
export function GetStartedWithApp({ plugin }) {
    const { value: pluginConfig } = usePluginConfig(plugin);
    if (!pluginConfig) {
        return null;
    }
    // Enforce RBAC
    if (!contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin)) {
        return null;
    }
    const { enabled, jsonData } = pluginConfig === null || pluginConfig === void 0 ? void 0 : pluginConfig.meta;
    const enable = () => updatePluginSettingsAndReload(plugin.id, {
        enabled: true,
        pinned: true,
        jsonData,
    });
    const disable = () => {
        updatePluginSettingsAndReload(plugin.id, {
            enabled: false,
            pinned: false,
            jsonData,
        });
    };
    return (React.createElement(React.Fragment, null,
        !enabled && (React.createElement(Button, { variant: "primary", onClick: enable }, "Enable")),
        enabled && (React.createElement(Button, { variant: "destructive", onClick: disable }, "Disable"))));
}
const updatePluginSettingsAndReload = (id, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield updatePluginSettings(id, data);
        // Reloading the page as the plugin meta changes made here wouldn't be propagated throughout the app.
        window.location.reload();
    }
    catch (e) {
        console.error('Error while updating the plugin', e);
    }
});
//# sourceMappingURL=GetStartedWithApp.js.map