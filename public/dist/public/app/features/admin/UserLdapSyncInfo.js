import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { AccessControlAction } from 'app/types';
import { Button, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
var format = 'dddd YYYY-MM-DD HH:mm zz';
var debugLDAPMappingBaseURL = '/admin/ldap';
var UserLdapSyncInfo = /** @class */ (function (_super) {
    __extends(UserLdapSyncInfo, _super);
    function UserLdapSyncInfo() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onUserSync = function () {
            _this.props.onUserSync();
        };
        return _this;
    }
    UserLdapSyncInfo.prototype.render = function () {
        var _a = this.props, ldapSyncInfo = _a.ldapSyncInfo, user = _a.user;
        var nextSyncSuccessful = ldapSyncInfo && ldapSyncInfo.nextSync;
        var nextSyncTime = nextSyncSuccessful ? dateTimeFormat(ldapSyncInfo.nextSync, { format: format }) : '';
        var debugLDAPMappingURL = debugLDAPMappingBaseURL + "?user=" + (user && user.login);
        var canReadLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersRead);
        var canSyncLDAPUser = contextSrv.hasPermission(AccessControlAction.LDAPUsersSync);
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
    };
    return UserLdapSyncInfo;
}(PureComponent));
export { UserLdapSyncInfo };
//# sourceMappingURL=UserLdapSyncInfo.js.map