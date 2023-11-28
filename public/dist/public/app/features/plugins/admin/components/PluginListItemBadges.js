import React from 'react';
import { PluginType } from '@grafana/data';
import { HorizontalGroup, PluginSignatureBadge } from '@grafana/ui';
import { PluginEnterpriseBadge, PluginDisabledBadge, PluginInstalledBadge, PluginUpdateAvailableBadge, PluginAngularBadge, PluginDeprecatedBadge, } from './Badges';
export function PluginListItemBadges({ plugin }) {
    // Currently renderer plugins are not supported by the catalog due to complications related to installation / update / uninstall.
    const hasUpdate = plugin.hasUpdate && !plugin.isCore && plugin.type !== PluginType.renderer;
    if (plugin.isEnterprise) {
        return (React.createElement(HorizontalGroup, { height: "auto", wrap: true },
            React.createElement(PluginEnterpriseBadge, { plugin: plugin }),
            plugin.isDisabled && React.createElement(PluginDisabledBadge, { error: plugin.error }),
            hasUpdate && React.createElement(PluginUpdateAvailableBadge, { plugin: plugin }),
            plugin.angularDetected && React.createElement(PluginAngularBadge, null)));
    }
    return (React.createElement(HorizontalGroup, { height: "auto", wrap: true },
        React.createElement(PluginSignatureBadge, { status: plugin.signature }),
        plugin.isDisabled && React.createElement(PluginDisabledBadge, { error: plugin.error }),
        plugin.isDeprecated && React.createElement(PluginDeprecatedBadge, null),
        plugin.isInstalled && React.createElement(PluginInstalledBadge, null),
        hasUpdate && React.createElement(PluginUpdateAvailableBadge, { plugin: plugin }),
        plugin.angularDetected && React.createElement(PluginAngularBadge, null)));
}
//# sourceMappingURL=PluginListItemBadges.js.map