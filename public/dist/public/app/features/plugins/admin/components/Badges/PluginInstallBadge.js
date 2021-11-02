import React from 'react';
import { Badge, useStyles2 } from '@grafana/ui';
import { getBadgeColor } from './sharedStyles';
export function PluginInstalledBadge() {
    var customBadgeStyles = useStyles2(getBadgeColor);
    return React.createElement(Badge, { text: "Installed", color: "orange", className: customBadgeStyles });
}
//# sourceMappingURL=PluginInstallBadge.js.map