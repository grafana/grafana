import React from 'react';
import { Tooltip, Icon } from '@grafana/ui';
export const LdapUserGroups = ({ groups, showAttributeMapping }) => {
    const items = showAttributeMapping ? groups : groups.filter((item) => item.orgRole);
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement("table", { className: "filter-table form-inline" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        showAttributeMapping && React.createElement("th", null, "LDAP Group"),
                        React.createElement("th", null,
                            "Organization",
                            React.createElement(Tooltip, { placement: "top", content: "Only the first match for an Organization will be used", theme: 'info' },
                                React.createElement(Icon, { name: "info-circle" }))),
                        React.createElement("th", null, "Role"))),
                React.createElement("tbody", null, items.map((group, index) => {
                    return (React.createElement("tr", { key: `${group.orgId}-${index}` },
                        showAttributeMapping && React.createElement("td", null, group.groupDN),
                        group.orgName && group.orgRole ? React.createElement("td", null, group.orgName) : React.createElement("td", null),
                        group.orgRole ? (React.createElement("td", null, group.orgRole)) : (React.createElement("td", null,
                            React.createElement("span", { className: "text-warning" }, "No match"),
                            React.createElement(Tooltip, { placement: "top", content: "No matching groups found", theme: 'info' },
                                React.createElement(Icon, { name: "info-circle" }))))));
                }))))));
};
//# sourceMappingURL=LdapUserGroups.js.map