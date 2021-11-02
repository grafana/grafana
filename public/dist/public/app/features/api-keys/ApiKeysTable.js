import React from 'react';
import { DeleteButton } from '@grafana/ui';
import { dateTimeFormat } from '@grafana/data';
export var ApiKeysTable = function (_a) {
    var apiKeys = _a.apiKeys, timeZone = _a.timeZone, onDelete = _a.onDelete;
    return (React.createElement("table", { className: "filter-table" },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Name"),
                React.createElement("th", null, "Role"),
                React.createElement("th", null, "Expires"),
                React.createElement("th", { style: { width: '34px' } }))),
        apiKeys.length > 0 ? (React.createElement("tbody", null, apiKeys.map(function (key) {
            return (React.createElement("tr", { key: key.id },
                React.createElement("td", null, key.name),
                React.createElement("td", null, key.role),
                React.createElement("td", null, formatDate(key.expiration, timeZone)),
                React.createElement("td", null,
                    React.createElement(DeleteButton, { "aria-label": "Delete API key", size: "sm", onConfirm: function () { return onDelete(key); } }))));
        }))) : null));
};
function formatDate(expiration, timeZone) {
    if (!expiration) {
        return 'No expiration date';
    }
    return dateTimeFormat(expiration, { timeZone: timeZone });
}
//# sourceMappingURL=ApiKeysTable.js.map