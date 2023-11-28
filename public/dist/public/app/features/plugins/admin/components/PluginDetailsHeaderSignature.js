import { css } from '@emotion/css';
import React from 'react';
import { PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { PluginSignatureDetailsBadge } from './PluginSignatureDetailsBadge';
// Designed to show plugin signature information in the header on the plugin's details page
export function PluginDetailsHeaderSignature({ plugin }) {
    const styles = useStyles2(getStyles);
    const isSignatureValid = plugin.signature === PluginSignatureStatus.valid;
    return (React.createElement("div", { className: styles.container },
        React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/", target: "_blank", rel: "noreferrer", className: styles.link },
            React.createElement(PluginSignatureBadge, { status: plugin.signature })),
        isSignatureValid && (React.createElement(PluginSignatureDetailsBadge, { signatureType: plugin.signatureType, signatureOrg: plugin.signatureOrg }))));
}
export const getStyles = (theme) => {
    return {
        container: css `
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.spacing(0.5)};
    `,
        link: css `
      display: inline-flex;
      align-items: center;
    `,
    };
};
//# sourceMappingURL=PluginDetailsHeaderSignature.js.map