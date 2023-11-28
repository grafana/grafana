import { css } from '@emotion/css';
import React from 'react';
import { PluginSignatureType } from '@grafana/data';
import { PluginDisabledBadge } from '../components/Badges';
import { PluginDetailsHeaderDependencies } from '../components/PluginDetailsHeaderDependencies';
import { PluginDetailsHeaderSignature } from '../components/PluginDetailsHeaderSignature';
import { getLatestCompatibleVersion } from '../helpers';
export const usePluginInfo = (plugin) => {
    var _a, _b, _c, _d;
    const info = [];
    if (!plugin) {
        return info;
    }
    // Populate info
    const latestCompatibleVersion = getLatestCompatibleVersion((_a = plugin.details) === null || _a === void 0 ? void 0 : _a.versions);
    const version = plugin.installedVersion || (latestCompatibleVersion === null || latestCompatibleVersion === void 0 ? void 0 : latestCompatibleVersion.version);
    if (Boolean(version)) {
        info.push({
            label: 'Version',
            value: version,
        });
    }
    if (Boolean(plugin.orgName)) {
        info.push({
            label: 'From',
            value: plugin.orgName,
        });
    }
    const showDownloads = !plugin.signatureType ||
        plugin.signatureType === PluginSignatureType.community ||
        plugin.signatureType === PluginSignatureType.commercial;
    if (showDownloads && Boolean(plugin.downloads > 0)) {
        info.push({
            label: 'Downloads',
            value: new Intl.NumberFormat().format(plugin.downloads),
        });
    }
    const pluginDependencies = (_b = plugin.details) === null || _b === void 0 ? void 0 : _b.pluginDependencies;
    const grafanaDependency = plugin.isInstalled
        ? (_c = plugin.details) === null || _c === void 0 ? void 0 : _c.grafanaDependency
        : (latestCompatibleVersion === null || latestCompatibleVersion === void 0 ? void 0 : latestCompatibleVersion.grafanaDependency) || ((_d = plugin.details) === null || _d === void 0 ? void 0 : _d.grafanaDependency);
    const hasNoDependencyInfo = !grafanaDependency && (!pluginDependencies || !pluginDependencies.length);
    if (!hasNoDependencyInfo) {
        info.push({
            label: 'Dependencies',
            value: React.createElement(PluginDetailsHeaderDependencies, { plugin: plugin, latestCompatibleVersion: latestCompatibleVersion }),
        });
    }
    if (plugin.isDisabled) {
        info.push({
            label: 'Status',
            value: React.createElement(PluginDisabledBadge, { error: plugin.error }),
        });
    }
    info.push({
        label: 'Signature',
        value: React.createElement(PluginDetailsHeaderSignature, { plugin: plugin }),
    });
    return info;
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
//# sourceMappingURL=usePluginInfo.js.map