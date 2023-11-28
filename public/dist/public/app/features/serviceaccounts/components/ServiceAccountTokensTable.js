import { css, cx } from '@emotion/css';
import React from 'react';
import { dateTimeFormat } from '@grafana/data';
import { DeleteButton, Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
export const ServiceAccountTokensTable = ({ tokens, timeZone, tokenActionsDisabled, onDelete }) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    return (React.createElement("table", { className: cx(styles.section, 'filter-table') },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Name"),
                React.createElement("th", null, "Expires"),
                React.createElement("th", null, "Created"),
                React.createElement("th", null, "Last used at"),
                React.createElement("th", null),
                React.createElement("th", null))),
        React.createElement("tbody", null, tokens.map((key) => {
            return (React.createElement("tr", { key: key.id, className: styles.tableRow(key.hasExpired || key.isRevoked) },
                React.createElement("td", null, key.name),
                React.createElement("td", null,
                    React.createElement(TokenExpiration, { timeZone: timeZone, token: key })),
                React.createElement("td", null, formatDate(timeZone, key.created)),
                React.createElement("td", null, formatLastUsedAtDate(timeZone, key.lastUsedAt)),
                React.createElement("td", { className: "width-1 text-center" }, key.isRevoked && React.createElement(TokenRevoked, null)),
                React.createElement("td", null,
                    React.createElement(DeleteButton, { "aria-label": `Delete service account token ${key.name}`, size: "sm", onConfirm: () => onDelete(key), disabled: tokenActionsDisabled }))));
        }))));
};
function formatLastUsedAtDate(timeZone, lastUsedAt) {
    if (!lastUsedAt) {
        return 'Never';
    }
    return dateTimeFormat(lastUsedAt, { timeZone });
}
function formatDate(timeZone, expiration) {
    if (!expiration) {
        return 'No expiration date';
    }
    return dateTimeFormat(expiration, { timeZone });
}
function formatSecondsLeftUntilExpiration(secondsUntilExpiration) {
    const days = Math.ceil(secondsUntilExpiration / (3600 * 24));
    const daysFormat = days > 1 ? `${days} days` : `${days} day`;
    return `Expires in ${daysFormat}`;
}
const TokenRevoked = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement("span", { className: styles.hasExpired },
        "Revoked",
        React.createElement("span", { className: styles.tooltipContainer },
            React.createElement(Tooltip, { content: "This token has been publicly exposed. Please rotate this token" },
                React.createElement(Icon, { name: "exclamation-triangle", className: styles.toolTipIcon })))));
};
const TokenExpiration = ({ timeZone, token }) => {
    const styles = useStyles2(getStyles);
    if (!token.expiration) {
        return React.createElement("span", { className: styles.neverExpire }, "Never");
    }
    if (token.secondsUntilExpiration) {
        return (React.createElement("span", { className: styles.secondsUntilExpiration }, formatSecondsLeftUntilExpiration(token.secondsUntilExpiration)));
    }
    if (token.hasExpired) {
        return (React.createElement("span", { className: styles.hasExpired },
            "Expired",
            React.createElement("span", { className: styles.tooltipContainer },
                React.createElement(Tooltip, { content: "This token has expired" },
                    React.createElement(Icon, { name: "exclamation-triangle", className: styles.toolTipIcon })))));
    }
    return React.createElement("span", null, formatDate(timeZone, token.expiration));
};
const getStyles = (theme) => ({
    tableRow: (hasExpired) => css `
    color: ${hasExpired ? theme.colors.text.secondary : theme.colors.text.primary};
  `,
    tooltipContainer: css `
    margin-left: ${theme.spacing(1)};
  `,
    toolTipIcon: css `
    color: ${theme.colors.error.text};
  `,
    secondsUntilExpiration: css `
    color: ${theme.colors.warning.text};
  `,
    hasExpired: css `
    color: ${theme.colors.error.text};
  `,
    neverExpire: css `
    color: ${theme.colors.text.secondary};
  `,
    section: css `
    margin-bottom: ${theme.spacing(4)};
  `,
});
//# sourceMappingURL=ServiceAccountTokensTable.js.map