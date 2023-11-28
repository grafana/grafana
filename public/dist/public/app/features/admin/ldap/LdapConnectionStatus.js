import React from 'react';
import { Alert, Icon } from '@grafana/ui';
import { AppNotificationSeverity } from 'app/types';
export const LdapConnectionStatus = ({ ldapConnectionInfo }) => {
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "LDAP Connection"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form" },
                React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "Host"),
                            React.createElement("th", { colSpan: 2 }, "Port"))),
                    React.createElement("tbody", null, ldapConnectionInfo &&
                        ldapConnectionInfo.map((serverInfo, index) => (React.createElement("tr", { key: index },
                            React.createElement("td", null, serverInfo.host),
                            React.createElement("td", null, serverInfo.port),
                            React.createElement("td", null, serverInfo.available ? (React.createElement(Icon, { name: "check", className: "pull-right" })) : (React.createElement(Icon, { name: "exclamation-triangle", className: "pull-right" }))))))))),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement(LdapErrorBox, { ldapConnectionInfo: ldapConnectionInfo })))));
};
export const LdapErrorBox = ({ ldapConnectionInfo }) => {
    const hasError = ldapConnectionInfo.some((info) => info.error);
    if (!hasError) {
        return null;
    }
    const connectionErrors = [];
    ldapConnectionInfo.forEach((info) => {
        if (info.error) {
            connectionErrors.push(info);
        }
    });
    const errorElements = connectionErrors.map((info, index) => (React.createElement("div", { key: index },
        React.createElement("span", { style: { fontWeight: 500 } },
            info.host,
            ":",
            info.port,
            React.createElement("br", null)),
        React.createElement("span", null, info.error),
        index !== connectionErrors.length - 1 && (React.createElement(React.Fragment, null,
            React.createElement("br", null),
            React.createElement("br", null))))));
    return (React.createElement(Alert, { title: "Connection error", severity: AppNotificationSeverity.Error }, errorElements));
};
//# sourceMappingURL=LdapConnectionStatus.js.map