import React from 'react';
import { PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge } from '@grafana/ui';
import { PluginSignatureDetailsBadge } from './PluginSignatureDetailsBadge';
// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature(_a) {
    var plugin = _a.plugin;
    var isSignatureValid = plugin.signature === PluginSignatureStatus.valid;
    return (React.createElement("div", null,
        React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/", target: "_blank", rel: "noreferrer" },
            React.createElement(PluginSignatureBadge, { status: plugin.signature })),
        isSignatureValid && (React.createElement(PluginSignatureDetailsBadge, { signatureType: plugin.signatureType, signatureOrg: plugin.signatureOrg }))));
}
//# sourceMappingURL=PluginDetailsHeaderSignature.js.map