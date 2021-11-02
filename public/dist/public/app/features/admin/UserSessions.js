import { __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { ConfirmButton, ConfirmModal, Button } from '@grafana/ui';
import { AccessControlAction } from 'app/types';
import { contextSrv } from 'app/core/core';
var UserSessions = /** @class */ (function (_super) {
    __extends(UserSessions, _super);
    function UserSessions() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            showLogoutModal: false,
        };
        _this.showLogoutConfirmationModal = function (show) { return function () {
            _this.setState({ showLogoutModal: show });
        }; };
        _this.onSessionRevoke = function (id) {
            return function () {
                _this.props.onSessionRevoke(id);
            };
        };
        _this.onAllSessionsRevoke = function () {
            _this.setState({ showLogoutModal: false });
            _this.props.onAllSessionsRevoke();
        };
        return _this;
    }
    UserSessions.prototype.render = function () {
        var _this = this;
        var sessions = this.props.sessions;
        var showLogoutModal = this.state.showLogoutModal;
        var logoutFromAllDevicesClass = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: 0.8rem;\n    "], ["\n      margin-top: 0.8rem;\n    "])));
        var canLogout = contextSrv.hasPermission(AccessControlAction.UsersLogout);
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "Sessions"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("thead", null,
                            React.createElement("tr", null,
                                React.createElement("th", null, "Last seen"),
                                React.createElement("th", null, "Logged on"),
                                React.createElement("th", null, "IP address"),
                                React.createElement("th", { colSpan: 2 }, "Browser and OS"))),
                        React.createElement("tbody", null, sessions &&
                            sessions.map(function (session, index) { return (React.createElement("tr", { key: session.id + "-" + index },
                                React.createElement("td", null, session.isActive ? 'Now' : session.seenAt),
                                React.createElement("td", null, session.createdAt),
                                React.createElement("td", null, session.clientIp),
                                React.createElement("td", null, session.browser + " on " + session.os + " " + session.osVersion),
                                React.createElement("td", null,
                                    React.createElement("div", { className: "pull-right" }, canLogout && (React.createElement(ConfirmButton, { confirmText: "Confirm logout", confirmVariant: "destructive", onConfirm: _this.onSessionRevoke(session.id) }, "Force logout")))))); })))),
                React.createElement("div", { className: logoutFromAllDevicesClass },
                    canLogout && sessions.length > 0 && (React.createElement(Button, { variant: "secondary", onClick: this.showLogoutConfirmationModal(true) }, "Force logout from all devices")),
                    React.createElement(ConfirmModal, { isOpen: showLogoutModal, title: "Force logout from all devices", body: "Are you sure you want to force logout from all devices?", confirmText: "Force logout", onConfirm: this.onAllSessionsRevoke, onDismiss: this.showLogoutConfirmationModal(false) })))));
    };
    return UserSessions;
}(PureComponent));
export { UserSessions };
var templateObject_1;
//# sourceMappingURL=UserSessions.js.map