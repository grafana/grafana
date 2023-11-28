import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { HorizontalGroup, Icon, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';
export const ReceiverMetadataBadge = ({ metadata: { icon, title, externalUrl, warning } }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Stack, { alignItems: "center", gap: 1 },
        React.createElement("div", { className: styles.wrapper },
            React.createElement(HorizontalGroup, { align: "center", spacing: "xs" },
                React.createElement("img", { src: icon, alt: "", height: "12px" }),
                React.createElement("span", null, title))),
        externalUrl && React.createElement(LinkButton, { icon: "external-link-alt", href: externalUrl, variant: "secondary", size: "sm" }),
        warning && (React.createElement(Tooltip, { content: warning, theme: "error" },
            React.createElement(Icon, { name: "exclamation-triangle", size: "lg", className: styles.warnIcon })))));
};
const getStyles = (theme) => ({
    wrapper: css `
    text-align: left;
    height: 22px;
    display: inline-flex;
    padding: 1px 4px;
    border-radius: ${theme.shape.borderRadius()};
    border: 1px solid rgba(245, 95, 62, 1);
    color: rgba(245, 95, 62, 1);
    font-weight: ${theme.typography.fontWeightRegular};
  `,
    warnIcon: css `
    fill: ${theme.colors.warning.main};
  `,
});
//# sourceMappingURL=ReceiverMetadataBadge.js.map