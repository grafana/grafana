import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { Icon, Text, Toggletip, useStyles2 } from '@grafana/ui';
export function NeedHelpInfo({ contentText, externalLink, linkText, title }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(Toggletip, { content: React.createElement("div", { className: styles.mutedText }, contentText), title: React.createElement(Stack, { gap: 1, direction: "row" },
            React.createElement(Icon, { name: "question-circle" }),
            title), footer: externalLink ? (React.createElement("a", { href: externalLink, target: "_blank", rel: "noreferrer" },
            React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "center" },
                React.createElement(Text, { color: "link" },
                    linkText,
                    " ",
                    React.createElement(Icon, { size: "sm", name: "external-link-alt" }))))) : undefined, closeButton: true, placement: "bottom-start" },
        React.createElement("div", { className: styles.helpInfo },
            React.createElement(Stack, { direction: "row", alignItems: "center", gap: 0.5 },
                React.createElement(Icon, { name: "question-circle", size: "sm" }),
                React.createElement(Text, { variant: "bodySmall", color: "primary" }, "Need help?")))));
}
const getStyles = (theme) => ({
    mutedText: css `
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.sm};
  `,
    helpInfo: css `
    cursor: pointer;
    text-decoration: underline;
  `,
});
//# sourceMappingURL=NeedHelpInfo.js.map