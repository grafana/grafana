import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { PluginSignatureStatus } from '@grafana/data';
import { Alert } from '@grafana/ui';
// Designed to show signature information inside the active tab on the plugin's details page
export function PluginDetailsSignature(_a) {
    var className = _a.className, plugin = _a.plugin;
    var isSignatureValid = plugin.signature === PluginSignatureStatus.valid;
    var isCore = plugin.signature === PluginSignatureStatus.internal;
    // The basic information is already available in the header
    if (isSignatureValid || isCore) {
        return null;
    }
    return (React.createElement(Alert, { severity: "warning", title: "Invalid plugin signature", "aria-label": selectors.pages.PluginPage.signatureInfo, className: className },
        React.createElement("p", null, "Grafana Labs checks each plugin to verify that it has a valid digital signature. Plugin signature verification is part of our security measures to ensure plugins are safe and trustworthy. Grafana Labs can\u2019t guarantee the integrity of this unsigned plugin. Ask the plugin author to request it to be signed."),
        React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/", className: "external-link", target: "_blank", rel: "noreferrer" }, "Read more about plugins signing.")));
}
//# sourceMappingURL=PluginDetailsSignature.js.map