import React from 'react';
import { Tooltip, Icon } from '@grafana/ui';
export const LdapUserTeams = ({ teams, showAttributeMapping }) => {
    const items = showAttributeMapping ? teams : teams.filter((item) => item.teamName);
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement("table", { className: "filter-table form-inline" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        showAttributeMapping && React.createElement("th", null, "LDAP Group"),
                        React.createElement("th", null, "Organisation"),
                        React.createElement("th", null, "Team"))),
                React.createElement("tbody", null, items.map((team, index) => {
                    return (React.createElement("tr", { key: `${team.teamName}-${index}` },
                        showAttributeMapping && (React.createElement(React.Fragment, null,
                            React.createElement("td", null, team.groupDN),
                            !team.orgName && (React.createElement(React.Fragment, null,
                                React.createElement("td", null),
                                React.createElement("td", null,
                                    React.createElement("span", { className: "text-warning" }, "No match"),
                                    React.createElement(Tooltip, { placement: "top", content: "No matching teams found", theme: 'info' },
                                        React.createElement(Icon, { name: "info-circle" }))))))),
                        team.orgName && (React.createElement(React.Fragment, null,
                            React.createElement("td", null, team.orgName),
                            React.createElement("td", null, team.teamName)))));
                }))))));
};
//# sourceMappingURL=LdapUserTeams.js.map