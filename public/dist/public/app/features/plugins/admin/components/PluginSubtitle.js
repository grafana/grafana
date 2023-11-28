import { css } from '@emotion/css';
import React from 'react';
import { Alert, useStyles2 } from '@grafana/ui';
import { InstallControlsWarning } from '../components/InstallControls';
import { getLatestCompatibleVersion, hasInstallControlWarning } from '../helpers';
import { useInstallStatus, useIsRemotePluginsAvailable } from '../state/hooks';
import { PluginStatus } from '../types';
export const PluginSubtitle = ({ plugin }) => {
    var _a, _b;
    const isRemotePluginsAvailable = useIsRemotePluginsAvailable();
    const styles = useStyles2(getStyles);
    const { error: errorInstalling } = useInstallStatus();
    if (!plugin) {
        return null;
    }
    const latestCompatibleVersion = getLatestCompatibleVersion((_a = plugin.details) === null || _a === void 0 ? void 0 : _a.versions);
    const pluginStatus = plugin.isInstalled
        ? plugin.hasUpdate
            ? PluginStatus.UPDATE
            : PluginStatus.UNINSTALL
        : PluginStatus.INSTALL;
    return (React.createElement("div", { className: styles.subtitle },
        errorInstalling && (React.createElement(Alert, { title: 'message' in errorInstalling ? errorInstalling.message : '' }, typeof errorInstalling === 'string' ? errorInstalling : errorInstalling.error)),
        (plugin === null || plugin === void 0 ? void 0 : plugin.description) && React.createElement("div", null, plugin === null || plugin === void 0 ? void 0 : plugin.description),
        ((_b = plugin === null || plugin === void 0 ? void 0 : plugin.details) === null || _b === void 0 ? void 0 : _b.links) && plugin.details.links.length > 0 && (React.createElement("span", null, plugin.details.links.map((link, index) => (React.createElement(React.Fragment, { key: index },
            index > 0 && ' | ',
            React.createElement("a", { href: link.url, className: "external-link" }, link.name)))))),
        hasInstallControlWarning(plugin, isRemotePluginsAvailable, latestCompatibleVersion) && (React.createElement(InstallControlsWarning, { plugin: plugin, pluginStatus: pluginStatus, latestCompatibleVersion: latestCompatibleVersion }))));
};
export const getStyles = (theme) => {
    return {
        subtitle: css `
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=PluginSubtitle.js.map