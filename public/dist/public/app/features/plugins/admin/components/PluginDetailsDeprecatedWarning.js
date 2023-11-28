import React, { useState } from 'react';
import { Alert } from '@grafana/ui';
export function PluginDetailsDeprecatedWarning(props) {
    var _a;
    const { className, plugin } = props;
    const [dismissed, setDismissed] = useState(false);
    const isWarningVisible = plugin.isDeprecated && !dismissed;
    let deprecationMessage = `This ${plugin.type} plugin is deprecated and has been removed from the catalog. No further updates will be made to the
  plugin.`;
    if ((_a = plugin.details) === null || _a === void 0 ? void 0 : _a.statusContext) {
        deprecationMessage += ` More information: ${plugin.details.statusContext}`;
    }
    return isWarningVisible ? (React.createElement(Alert, { severity: "warning", title: "Deprecated", className: className, onRemove: () => setDismissed(true) },
        React.createElement("p", null, deprecationMessage))) : null;
}
//# sourceMappingURL=PluginDetailsDeprecatedWarning.js.map