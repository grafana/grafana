import { css } from '@emotion/css';
import React, { useState } from 'react';
import { config } from '@grafana/runtime';
import { HorizontalGroup, Icon, useStyles2, VerticalGroup } from '@grafana/ui';
import { GetStartedWithPlugin } from '../components/GetStartedWithPlugin';
import { InstallControlsButton } from '../components/InstallControls';
import { ExternallyManagedButton } from '../components/InstallControls/ExternallyManagedButton';
import { getLatestCompatibleVersion, hasInstallControlWarning, isInstallControlsEnabled } from '../helpers';
import { useIsRemotePluginsAvailable } from '../state/hooks';
import { PluginStatus } from '../types';
export const PluginActions = ({ plugin }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
    const latestCompatibleVersion = getLatestCompatibleVersion((_a = plugin === null || plugin === void 0 ? void 0 : plugin.details) === null || _a === void 0 ? void 0 : _a.versions);
    const [needReload, setNeedReload] = useState(false);
    if (!plugin) {
        return null;
    }
    const hasInstallWarning = hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion);
    const isExternallyManaged = config.pluginAdminExternalManageEnabled;
    const pluginStatus = plugin.isInstalled
        ? plugin.hasUpdate
            ? PluginStatus.UPDATE
            : PluginStatus.UNINSTALL
        : PluginStatus.INSTALL;
    const isInstallControlsDisabled = plugin.isCore || plugin.isDisabled || !isInstallControlsEnabled();
    return (React.createElement(VerticalGroup, null,
        React.createElement(HorizontalGroup, null,
            !isInstallControlsDisabled && (React.createElement(React.Fragment, null, isExternallyManaged && !hasInstallWarning ? (React.createElement(ExternallyManagedButton, { pluginId: plugin.id, pluginStatus: pluginStatus, angularDetected: plugin.angularDetected })) : (React.createElement(InstallControlsButton, { plugin: plugin, latestCompatibleVersion: latestCompatibleVersion, pluginStatus: pluginStatus, setNeedReload: setNeedReload, hasInstallWarning: hasInstallWarning })))),
            React.createElement(GetStartedWithPlugin, { plugin: plugin })),
        needReload && (React.createElement(HorizontalGroup, null,
            React.createElement(Icon, { name: "exclamation-triangle" }),
            React.createElement("span", { className: styles.message }, "Refresh the page to see the changes")))));
};
const getStyles = (theme) => {
    return {
        message: css `
      color: ${theme.colors.text.secondary};
    `,
    };
};
//# sourceMappingURL=PluginActions.js.map