import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { dateTimeFormat } from '@grafana/data';
import { Button, Spinner } from '@grafana/ui';
var format = 'dddd YYYY-MM-DD HH:mm zz';
var LdapSyncInfo = /** @class */ (function (_super) {
    __extends(LdapSyncInfo, _super);
    function LdapSyncInfo() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isSyncing: false,
        };
        _this.handleSyncClick = function () {
            _this.setState({ isSyncing: !_this.state.isSyncing });
        };
        return _this;
    }
    LdapSyncInfo.prototype.render = function () {
        var ldapSyncInfo = this.props.ldapSyncInfo;
        var isSyncing = this.state.isSyncing;
        var nextSyncTime = dateTimeFormat(ldapSyncInfo.nextSync, { format: format });
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" },
                "LDAP Synchronisation",
                React.createElement(Button, { className: "pull-right", onClick: this.handleSyncClick, hidden: true },
                    React.createElement("span", { className: "btn-title" }, "Bulk-sync now"),
                    isSyncing && React.createElement(Spinner, { inline: true }))),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("tbody", null,
                            React.createElement("tr", null,
                                React.createElement("td", null, "Active synchronisation"),
                                React.createElement("td", { colSpan: 2 }, ldapSyncInfo.enabled ? 'Enabled' : 'Disabled')),
                            React.createElement("tr", null,
                                React.createElement("td", null, "Scheduled"),
                                React.createElement("td", null, ldapSyncInfo.schedule)),
                            React.createElement("tr", null,
                                React.createElement("td", null, "Next scheduled synchronisation"),
                                React.createElement("td", null, nextSyncTime))))))));
    };
    return LdapSyncInfo;
}(PureComponent));
export { LdapSyncInfo };
//# sourceMappingURL=LdapSyncInfo.js.map