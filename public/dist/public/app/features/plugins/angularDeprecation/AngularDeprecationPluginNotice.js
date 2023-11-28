import React, { useState } from 'react';
import { PluginType } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
function deprecationMessage(pluginType, angularSupportEnabled) {
    let pluginTypeString;
    switch (pluginType) {
        case PluginType.app:
            pluginTypeString = 'app plugin';
            break;
        case PluginType.panel:
            pluginTypeString = 'panel plugin';
            break;
        case PluginType.datasource:
            pluginTypeString = 'data source plugin';
            break;
        default:
            pluginTypeString = 'plugin';
    }
    let msg = `This ${pluginTypeString} uses a deprecated, legacy platform based on AngularJS and `;
    if (angularSupportEnabled === undefined) {
        return msg + ' may be incompatible depending on your Grafana configuration.';
    }
    if (angularSupportEnabled) {
        return msg + ' will stop working in future releases of Grafana.';
    }
    return msg + ' is incompatible with your current Grafana configuration.';
}
// An Alert showing information about Angular deprecation notice.
// If the plugin does not use Angular (!plugin.angularDetected), it returns null.
export function AngularDeprecationPluginNotice(props) {
    const { className, angularSupportEnabled, pluginId, pluginType, showPluginDetailsLink, interactionElementId } = props;
    const [dismissed, setDismissed] = useState(false);
    const interactionAttributes = {};
    if (pluginId) {
        interactionAttributes.pluginId = pluginId;
    }
    if (interactionElementId) {
        interactionAttributes.elementId = interactionElementId;
    }
    return dismissed ? null : (React.createElement(Alert, { severity: "warning", title: "Angular plugin", className: className, onRemove: () => setDismissed(true) },
        React.createElement("p", null, deprecationMessage(pluginType, angularSupportEnabled)),
        React.createElement("div", { className: "markdown-html" },
            React.createElement("ul", null,
                React.createElement("li", null,
                    React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/developers/angular_deprecation/", className: "external-link", target: "_blank", rel: "noreferrer", onClick: () => {
                            reportInteraction('angular_deprecation_docs_clicked', interactionAttributes);
                        } }, "Read our deprecation notice and migration advice.")),
                showPluginDetailsLink && pluginId ? (React.createElement("li", null,
                    React.createElement("a", { href: `plugins/${encodeURIComponent(pluginId)}`, className: "external-link", target: "_blank", rel: "noreferrer" }, "View plugin details"))) : null))));
}
//# sourceMappingURL=AngularDeprecationPluginNotice.js.map