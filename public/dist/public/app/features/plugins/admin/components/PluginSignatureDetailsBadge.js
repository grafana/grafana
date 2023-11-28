import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React from 'react';
import { PluginSignatureType } from '@grafana/data';
import { useStyles2, Icon, Badge } from '@grafana/ui';
const SIGNATURE_ICONS = {
    [PluginSignatureType.grafana]: 'grafana',
    [PluginSignatureType.commercial]: 'shield',
    [PluginSignatureType.community]: 'shield',
    DEFAULT: 'shield-exclamation',
};
// Shows more information about a valid signature
export function PluginSignatureDetailsBadge({ signatureType, signatureOrg = '' }) {
    const styles = useStyles2(getStyles);
    if (!signatureType && !signatureOrg) {
        return null;
    }
    const signatureTypeText = signatureType === PluginSignatureType.grafana ? 'Grafana Labs' : capitalize(signatureType);
    const signatureIcon = SIGNATURE_ICONS[signatureType || ''] || SIGNATURE_ICONS.DEFAULT;
    return (React.createElement(React.Fragment, null,
        React.createElement(DetailsBadge, null,
            React.createElement("div", { className: styles.detailsWrapper },
                React.createElement("strong", { className: styles.strong }, "Level:\u00A0"),
                React.createElement(Icon, { size: "xs", name: signatureIcon }),
                "\u00A0",
                signatureTypeText)),
        React.createElement(DetailsBadge, null,
            React.createElement("strong", { className: styles.strong }, "Signed by:"),
            " ",
            signatureOrg)));
}
export const DetailsBadge = ({ children }) => {
    const styles = useStyles2(getStyles);
    return React.createElement(Badge, { color: "green", className: styles.badge, text: children });
};
const getStyles = (theme) => ({
    badge: css `
    background-color: ${theme.colors.background.canvas};
    border-color: ${theme.colors.border.strong};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
  `,
    detailsWrapper: css `
    align-items: center;
    display: flex;
  `,
    strong: css `
    color: ${theme.colors.text.primary};
  `,
    icon: css `
    margin-right: ${theme.spacing(0.5)};
  `,
});
//# sourceMappingURL=PluginSignatureDetailsBadge.js.map