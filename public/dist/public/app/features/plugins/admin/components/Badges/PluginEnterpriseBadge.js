import React from 'react';
import { featureEnabled } from '@grafana/runtime';
import { Badge, Button, HorizontalGroup, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { getBadgeColor } from './sharedStyles';
export function PluginEnterpriseBadge({ plugin }) {
    const customBadgeStyles = useStyles2(getBadgeColor);
    const onClick = (ev) => {
        ev.preventDefault();
        window.open(`https://grafana.com/grafana/plugins/${plugin.id}?utm_source=grafana_catalog_learn_more`, '_blank', 'noopener,noreferrer');
    };
    if (featureEnabled('enterprise.plugins')) {
        return React.createElement(Badge, { text: "Enterprise", color: "blue" });
    }
    return (React.createElement(HorizontalGroup, null,
        React.createElement(PluginSignatureBadge, { status: plugin.signature }),
        React.createElement(Badge, { icon: "lock", "aria-label": "lock icon", text: "Enterprise", color: "blue", className: customBadgeStyles }),
        React.createElement(Button, { size: "sm", fill: "text", icon: "external-link-alt", onClick: onClick }, "Learn more")));
}
//# sourceMappingURL=PluginEnterpriseBadge.js.map