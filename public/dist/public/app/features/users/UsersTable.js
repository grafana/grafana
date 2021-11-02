import { __read } from "tslib";
import React, { useState } from 'react';
import { AccessControlAction } from 'app/types';
import { OrgRolePicker } from '../admin/OrgRolePicker';
import { Button, ConfirmModal } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
var UsersTable = function (props) {
    var users = props.users, onRoleChange = props.onRoleChange, onRemoveUser = props.onRemoveUser;
    var canUpdateRole = contextSrv.hasPermission(AccessControlAction.OrgUsersRoleUpdate);
    var canRemoveFromOrg = contextSrv.hasPermission(AccessControlAction.OrgUsersRemove);
    var _a = __read(useState(false), 2), showRemoveModal = _a[0], setShowRemoveModal = _a[1];
    return (React.createElement("table", { className: "filter-table form-inline" },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null),
                React.createElement("th", null, "Login"),
                React.createElement("th", null, "Email"),
                React.createElement("th", null, "Name"),
                React.createElement("th", null, "Seen"),
                React.createElement("th", null, "Role"),
                React.createElement("th", { style: { width: '34px' } }))),
        React.createElement("tbody", null, users.map(function (user, index) {
            return (React.createElement("tr", { key: user.userId + "-" + index },
                React.createElement("td", { className: "width-2 text-center" },
                    React.createElement("img", { className: "filter-table__avatar", src: user.avatarUrl, alt: "User avatar" })),
                React.createElement("td", { className: "max-width-6" },
                    React.createElement("span", { className: "ellipsis", title: user.login }, user.login)),
                React.createElement("td", { className: "max-width-5" },
                    React.createElement("span", { className: "ellipsis", title: user.email }, user.email)),
                React.createElement("td", { className: "max-width-5" },
                    React.createElement("span", { className: "ellipsis", title: user.name }, user.name)),
                React.createElement("td", { className: "width-1" }, user.lastSeenAtAge),
                React.createElement("td", { className: "width-8" },
                    React.createElement(OrgRolePicker, { "aria-label": "Role", value: user.role, disabled: !canUpdateRole, onChange: function (newRole) { return onRoleChange(newRole, user); } })),
                canRemoveFromOrg && (React.createElement("td", null,
                    React.createElement(Button, { size: "sm", variant: "destructive", onClick: function () { return setShowRemoveModal(user.login); }, icon: "times", "aria-label": "Delete user" }),
                    React.createElement(ConfirmModal, { body: "Are you sure you want to delete user " + user.login + "?", confirmText: "Delete", title: "Delete", onDismiss: function () { return setShowRemoveModal(false); }, isOpen: user.login === showRemoveModal, onConfirm: function () {
                            onRemoveUser(user);
                        } })))));
        }))));
};
export default UsersTable;
//# sourceMappingURL=UsersTable.js.map