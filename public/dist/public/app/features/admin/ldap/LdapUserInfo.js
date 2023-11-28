import React from 'react';
import { LdapUserGroups } from './LdapUserGroups';
import { LdapUserMappingInfo } from './LdapUserMappingInfo';
import { LdapUserPermissions } from './LdapUserPermissions';
import { LdapUserTeams } from './LdapUserTeams';
export const LdapUserInfo = ({ ldapUser, showAttributeMapping }) => {
    return (React.createElement(React.Fragment, null,
        React.createElement(LdapUserMappingInfo, { info: ldapUser.info, showAttributeMapping: showAttributeMapping }),
        React.createElement(LdapUserPermissions, { permissions: ldapUser.permissions }),
        ldapUser.roles && ldapUser.roles.length > 0 && (React.createElement(LdapUserGroups, { groups: ldapUser.roles, showAttributeMapping: showAttributeMapping })),
        ldapUser.teams && ldapUser.teams.length > 0 ? (React.createElement(LdapUserTeams, { teams: ldapUser.teams, showAttributeMapping: showAttributeMapping })) : (React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form" },
                React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("tbody", null,
                        React.createElement("tr", null,
                            React.createElement("td", null, "No teams found via LDAP")))))))));
};
//# sourceMappingURL=LdapUserInfo.js.map