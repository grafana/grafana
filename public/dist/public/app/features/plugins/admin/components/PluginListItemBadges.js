import React from 'react';
import { HorizontalGroup, PluginSignatureBadge } from '@grafana/ui';
import { PluginEnterpriseBadge, PluginDisabledBadge, PluginInstalledBadge, PluginUpdateAvailableBadge } from './Badges';
export function PluginListItemBadges(_a) {
    var plugin = _a.plugin;
    if (plugin.isEnterprise) {
        return (React.createElement(HorizontalGroup, { height: "auto", wrap: true },
            React.createElement(PluginEnterpriseBadge, { plugin: plugin }),
            plugin.isDisabled && React.createElement(PluginDisabledBadge, { error: plugin.error }),
            React.createElement(PluginUpdateAvailableBadge, { plugin: plugin })));
    }
    return (React.createElement(HorizontalGroup, { height: "auto", wrap: true },
        React.createElement(PluginSignatureBadge, { status: plugin.signature }),
        plugin.isDisabled && React.createElement(PluginDisabledBadge, { error: plugin.error }),
        plugin.isInstalled && React.createElement(PluginInstalledBadge, null),
        React.createElement(PluginUpdateAvailableBadge, { plugin: plugin })));
}
//# sourceMappingURL=PluginListItemBadges.js.map