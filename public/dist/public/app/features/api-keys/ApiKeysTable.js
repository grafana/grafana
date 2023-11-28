import { css } from '@emotion/css';
import React from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Button, DeleteButton, HorizontalGroup, Icon, Tooltip, useTheme2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
export const ApiKeysTable = ({ apiKeys, timeZone, onDelete, onMigrate }) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    return (React.createElement("table", { className: "filter-table" },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Name"),
                React.createElement("th", null, "Role"),
                React.createElement("th", null, "Expires"),
                React.createElement("th", null, "Last used at"),
                React.createElement("th", { style: { width: '34px' } }))),
        apiKeys.length > 0 ? (React.createElement("tbody", null, apiKeys.map((key) => {
            const isExpired = Boolean(key.expiration && Date.now() > new Date(key.expiration).getTime());
            return (React.createElement("tr", { key: key.id, className: styles.tableRow(isExpired) },
                React.createElement("td", null, key.name),
                React.createElement("td", null, key.role),
                React.createElement("td", null,
                    formatDate(key.expiration, timeZone),
                    isExpired && (React.createElement("span", { className: styles.tooltipContainer },
                        React.createElement(Tooltip, { content: "This API key has expired." },
                            React.createElement(Icon, { name: "exclamation-triangle" }))))),
                React.createElement("td", null, formatLastUsedAtDate(timeZone, key.lastUsedAt)),
                React.createElement("td", null,
                    React.createElement(HorizontalGroup, { justify: "flex-end" },
                        React.createElement(Button, { size: "sm", onClick: () => onMigrate(key) }, "Migrate to service account"),
                        React.createElement(DeleteButton, { "aria-label": "Delete API key", size: "sm", onConfirm: () => onDelete(key), disabled: !contextSrv.hasPermissionInMetadata(AccessControlAction.ActionAPIKeysDelete, key) })))));
        }))) : null));
};
function formatLastUsedAtDate(timeZone, lastUsedAt) {
    if (!lastUsedAt) {
        return 'Never';
    }
    return dateTimeFormat(lastUsedAt, { timeZone });
}
function formatDate(expiration, timeZone) {
    if (!expiration) {
        return 'No expiration date';
    }
    return dateTimeFormat(expiration, { timeZone });
}
const getStyles = (theme) => ({
    tableRow: (isExpired) => css `
    color: ${isExpired ? theme.colors.text.secondary : theme.colors.text.primary};
  `,
    tooltipContainer: css `
    margin-left: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=ApiKeysTable.js.map