import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Button, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
const format = 'dddd YYYY-MM-DD HH:mm zz';
const debugLDAPMappingBaseURL = '/admin/authentication/ldap';
export class UserLdapSyncInfo extends PureComponent {
    constructor() {
        super(...arguments);
        this.onUserSync = () => {
            this.props.onUserSync();
        };
    }
    render() {
        const { ldapSyncInfo, user } = this.props;
        const nextSyncSuccessful = ldapSyncInfo && ldapSyncInfo.nextSync;
        const nextSyncTime = nextSyncSuccessful ? dateTimeFormat(ldapSyncInfo.nextSync, { format }) : '';
        const debugLDAPMappingURL = `${debugLDAPMappingBaseURL}?user=${user && user.login}`;
        const canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
        const canSyncLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersSync);
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "LDAP Synchronisation"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("tbody", null,
                            React.createElement("tr", null,
                                React.createElement("td", null, "External sync"),
                                React.createElement("td", null, "User synced via LDAP. Some changes must be done in LDAP or mappings."),
                                React.createElement("td", null,
                                    React.createElement("span", { className: "label label-tag" }, "LDAP"))),
                            React.createElement("tr", null, ldapSyncInfo.enabled ? (React.createElement(React.Fragment, null,
                                React.createElement("td", null, "Next scheduled synchronization"),
                                React.createElement("td", { colSpan: 2 }, nextSyncTime))) : (React.createElement(React.Fragment, null,
                                React.createElement("td", null, "Next scheduled synchronization"),
                                React.createElement("td", { colSpan: 2 }, "Not enabled"))))))),
                React.createElement("div", { className: "gf-form-button-row" },
                    canSyncLDAPUser && (React.createElement(Button, { variant: "secondary", onClick: this.onUserSync }, "Sync user")),
                    canReadLDAPUser && (React.createElement(LinkButton, { variant: "secondary", href: debugLDAPMappingURL }, "Debug LDAP Mapping"))))));
    }
}
//# sourceMappingURL=UserLdapSyncInfo.js.map