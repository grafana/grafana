import React from 'react';
import { PluginErrorCode } from '@grafana/data';
import { Badge } from '@grafana/ui';
export function PluginDisabledBadge({ error }) {
    const tooltip = errorCodeToTooltip(error);
    return React.createElement(Badge, { icon: "exclamation-triangle", text: "Disabled", color: "red", tooltip: tooltip });
}
function errorCodeToTooltip(error) {
    switch (error) {
        case PluginErrorCode.modifiedSignature:
            return 'Plugin disabled due to modified content';
        case PluginErrorCode.invalidSignature:
            return 'Plugin disabled due to invalid plugin signature';
        case PluginErrorCode.missingSignature:
            return 'Plugin disabled due to missing plugin signature';
        case null:
        case undefined:
            return 'Plugin disabled';
        default:
            return `Plugin disabled due to unknown error${error ? `: ${error}` : ''}`;
    }
}
//# sourceMappingURL=PluginDisabledBadge.js.map