import React from 'react';
export const LdapUserMappingInfo = ({ info, showAttributeMapping }) => {
    return (React.createElement("div", { className: "gf-form-group" },
        React.createElement("div", { className: "gf-form" },
            React.createElement("table", { className: "filter-table form-inline" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", { colSpan: 2 }, "User information"),
                        showAttributeMapping && React.createElement("th", null, "LDAP attribute"))),
                React.createElement("tbody", null,
                    React.createElement("tr", null,
                        React.createElement("td", { className: "width-16" }, "First name"),
                        React.createElement("td", null, info.name.ldapValue),
                        showAttributeMapping && React.createElement("td", null, info.name.cfgAttrValue)),
                    React.createElement("tr", null,
                        React.createElement("td", { className: "width-16" }, "Surname"),
                        React.createElement("td", null, info.surname.ldapValue),
                        showAttributeMapping && React.createElement("td", null, info.surname.cfgAttrValue)),
                    React.createElement("tr", null,
                        React.createElement("td", { className: "width-16" }, "Username"),
                        React.createElement("td", null, info.login.ldapValue),
                        showAttributeMapping && React.createElement("td", null, info.login.cfgAttrValue)),
                    React.createElement("tr", null,
                        React.createElement("td", { className: "width-16" }, "Email"),
                        React.createElement("td", null, info.email.ldapValue),
                        showAttributeMapping && React.createElement("td", null, info.email.cfgAttrValue)))))));
};
//# sourceMappingURL=LdapUserMappingInfo.js.map