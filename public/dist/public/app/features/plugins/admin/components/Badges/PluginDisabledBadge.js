import React from 'react';
import { PluginErrorCode } from '@grafana/data';
import { Badge } from '@grafana/ui';
export function PluginDisabledBadge(_a) {
    var error = _a.error;
    var tooltip = errorCodeToTooltip(error);
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
        default:
            return "Plugin disabled due to unkown error: " + error;
    }
}
//# sourceMappingURL=PluginDisabledBadge.js.map