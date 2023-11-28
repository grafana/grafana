import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { ConfirmButton, ConfirmModal, Button } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { i18nDate } from 'app/core/internationalization';
import { AccessControlAction } from 'app/types';
class BaseUserSessions extends PureComponent {
    constructor() {
        super(...arguments);
        this.forceAllLogoutButton = React.createRef();
        this.state = {
            showLogoutModal: false,
        };
        this.showLogoutConfirmationModal = () => {
            this.setState({ showLogoutModal: true });
        };
        this.dismissLogoutConfirmationModal = () => {
            this.setState({ showLogoutModal: false }, () => {
                var _a;
                (_a = this.forceAllLogoutButton.current) === null || _a === void 0 ? void 0 : _a.focus();
            });
        };
        this.onSessionRevoke = (id) => {
            return () => {
                this.props.onSessionRevoke(id);
            };
        };
        this.onAllSessionsRevoke = () => {
            this.setState({ showLogoutModal: false });
            this.props.onAllSessionsRevoke();
        };
    }
    render() {
        const { sessions } = this.props;
        const { showLogoutModal } = this.state;
        const logoutFromAllDevicesClass = css `
      margin-top: 0.8rem;
    `;
        const canLogout = contextSrv.hasPermission(AccessControlAction.UsersLogout);
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
                            sessions.map((session, index) => (React.createElement("tr", { key: `${session.id}-${index}` },
                                React.createElement("td", null, session.isActive ? 'Now' : session.seenAt),
                                React.createElement("td", null, i18nDate(session.createdAt, { dateStyle: 'long' })),
                                React.createElement("td", null, session.clientIp),
                                React.createElement("td", null, `${session.browser} on ${session.os} ${session.osVersion}`),
                                React.createElement("td", null,
                                    React.createElement("div", { className: "pull-right" }, canLogout && (React.createElement(ConfirmButton, { confirmText: "Confirm logout", confirmVariant: "destructive", onConfirm: this.onSessionRevoke(session.id), autoFocus: true }, "Force logout")))))))))),
                React.createElement("div", { className: logoutFromAllDevicesClass },
                    canLogout && sessions.length > 0 && (React.createElement(Button, { variant: "secondary", onClick: this.showLogoutConfirmationModal, ref: this.forceAllLogoutButton }, "Force logout from all devices")),
                    React.createElement(ConfirmModal, { isOpen: showLogoutModal, title: "Force logout from all devices", body: "Are you sure you want to force logout from all devices?", confirmText: "Force logout", onConfirm: this.onAllSessionsRevoke, onDismiss: this.dismissLogoutConfirmationModal })))));
    }
}
export const UserSessions = BaseUserSessions;
//# sourceMappingURL=UserSessions.js.map