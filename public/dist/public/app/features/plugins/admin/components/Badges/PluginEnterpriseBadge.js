import React from 'react';
import { Badge, Button, HorizontalGroup, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { getBadgeColor } from './sharedStyles';
import { config } from '@grafana/runtime';
export function PluginEnterpriseBadge(_a) {
    var _b;
    var plugin = _a.plugin;
    var customBadgeStyles = useStyles2(getBadgeColor);
    var onClick = function (ev) {
        ev.preventDefault();
        window.open("https://grafana.com/grafana/plugins/" + plugin.id + "?utm_source=grafana_catalog_learn_more", '_blank', 'noopener,noreferrer');
    };
    if ((_b = config.licenseInfo) === null || _b === void 0 ? void 0 : _b.hasValidLicense) {
        return React.createElement(Badge, { text: "Enterprise", color: "blue" });
    }
    return (React.createElement(HorizontalGroup, null,
        React.createElement(PluginSignatureBadge, { status: plugin.signature }),
        React.createElement(Badge, { icon: "lock", "aria-label": "lock icon", text: "Enterprise", color: "blue", className: customBadgeStyles }),
        React.createElement(Button, { size: "sm", fill: "text", icon: "external-link-alt", onClick: onClick }, "Learn more")));
}
//# sourceMappingURL=PluginEnterpriseBadge.js.map