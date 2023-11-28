import React from 'react';
import { Icon } from '@grafana/ui';
export const LdapUserPermissions = ({ permissions }) => {
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement("table", { className: "filter-table form-inline" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", { colSpan: 1 }, "Permissions"))),
                React.createElement("tbody", null,
                    React.createElement("tr", null,
                        React.createElement("td", { className: "width-16" }, " Grafana admin"),
                        React.createElement("td", null, permissions.isGrafanaAdmin ? (React.createElement(React.Fragment, null,
                            React.createElement(Icon, { name: "shield" }),
                            " Yes")) : ('No'))),
                    React.createElement("tr", null,
                        React.createElement("td", { className: "width-16" }, "Status"),
                        React.createElement("td", null, permissions.isDisabled ? (React.createElement(React.Fragment, null,
                            React.createElement(Icon, { name: "times" }),
                            " Inactive")) : (React.createElement(React.Fragment, null,
                            React.createElement(Icon, { name: "check" }),
                            " Active")))))))));
};
//# sourceMappingURL=LdapUserPermissions.js.map