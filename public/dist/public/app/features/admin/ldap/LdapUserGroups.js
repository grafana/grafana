import React from 'react';
import { Tooltip, Icon } from '@grafana/ui';
export var LdapUserGroups = function (_a) {
    var groups = _a.groups, showAttributeMapping = _a.showAttributeMapping;
    var items = showAttributeMapping ? groups : groups.filter(function (item) { return item.orgRole; });
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement("table", { className: "filter-table form-inline" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        showAttributeMapping && React.createElement("th", null, "LDAP Group"),
                        React.createElement("th", null,
                            "Organization",
                            React.createElement(Tooltip, { placement: "top", content: "Only the first match for an Organization will be used", theme: 'info' },
                                React.createElement("span", { className: "gf-form-help-icon" },
                                    React.createElement(Icon, { name: "info-circle" })))),
                        React.createElement("th", null, "Role"))),
                React.createElement("tbody", null, items.map(function (group, index) {
                    return (React.createElement("tr", { key: group.orgId + "-" + index },
                        showAttributeMapping && (React.createElement(React.Fragment, null,
                            React.createElement("td", null, group.groupDN),
                            !group.orgRole && (React.createElement(React.Fragment, null,
                                React.createElement("td", null),
                                React.createElement("td", null,
                                    React.createElement("span", { className: "text-warning" },
                                        "No match",
                                        React.createElement(Tooltip, { placement: "top", content: "No matching groups found", theme: 'info' },
                                            React.createElement("span", { className: "gf-form-help-icon" },
                                                React.createElement(Icon, { name: "info-circle" }))))))))),
                        group.orgName && (React.createElement(React.Fragment, null,
                            React.createElement("td", null, group.orgName),
                            React.createElement("td", null, group.orgRole)))));
                }))))));
};
//# sourceMappingURL=LdapUserGroups.js.map