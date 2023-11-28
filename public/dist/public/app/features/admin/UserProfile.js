import { css, cx } from '@emotion/css';
import React, { PureComponent, useRef, useState } from 'react';
import { Button, ConfirmButton, ConfirmModal, Input, LegacyInputStatus } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
export function UserProfile({ user, onUserUpdate, onUserDelete, onUserDisable, onUserEnable, onPasswordChange, }) {
    var _a;
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDisableModal, setShowDisableModal] = useState(false);
    const deleteUserRef = useRef(null);
    const showDeleteUserModal = (show) => () => {
        setShowDeleteModal(show);
        if (!show && deleteUserRef.current) {
            deleteUserRef.current.focus();
        }
    };
    const disableUserRef = useRef(null);
    const showDisableUserModal = (show) => () => {
        setShowDisableModal(show);
        if (!show && disableUserRef.current) {
            disableUserRef.current.focus();
        }
    };
    const handleUserDelete = () => onUserDelete(user.id);
    const handleUserDisable = () => onUserDisable(user.id);
    const handleUserEnable = () => onUserEnable(user.id);
    const onUserNameChange = (newValue) => {
        onUserUpdate(Object.assign(Object.assign({}, user), { name: newValue }));
    };
    const onUserEmailChange = (newValue) => {
        onUserUpdate(Object.assign(Object.assign({}, user), { email: newValue }));
    };
    const onUserLoginChange = (newValue) => {
        onUserUpdate(Object.assign(Object.assign({}, user), { login: newValue }));
    };
    const authSource = ((_a = user.authLabels) === null || _a === void 0 ? void 0 : _a.length) && user.authLabels[0];
    const lockMessage = authSource ? `Synced via ${authSource}` : '';
    const editLocked = user.isExternal || !contextSrv.hasPermissionInMetadata(AccessControlAction.UsersWrite, user);
    const passwordChangeLocked = user.isExternal || !contextSrv.hasPermissionInMetadata(AccessControlAction.UsersPasswordUpdate, user);
    const canDelete = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDelete, user);
    const canDisable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersDisable, user);
    const canEnable = contextSrv.hasPermissionInMetadata(AccessControlAction.UsersEnable, user);
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "User information"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form" },
                React.createElement("table", { className: "filter-table form-inline" },
                    React.createElement("tbody", null,
                        React.createElement(UserProfileRow, { label: "Name", value: user.name, locked: editLocked, lockMessage: lockMessage, onChange: onUserNameChange }),
                        React.createElement(UserProfileRow, { label: "Email", value: user.email, locked: editLocked, lockMessage: lockMessage, onChange: onUserEmailChange }),
                        React.createElement(UserProfileRow, { label: "Username", value: user.login, locked: editLocked, lockMessage: lockMessage, onChange: onUserLoginChange }),
                        React.createElement(UserProfileRow, { label: "Password", value: "********", inputType: "password", locked: passwordChangeLocked, lockMessage: lockMessage, onChange: onPasswordChange })))),
            React.createElement("div", { className: styles.buttonRow },
                canDelete && (React.createElement(React.Fragment, null,
                    React.createElement(Button, { variant: "destructive", onClick: showDeleteUserModal(true), ref: deleteUserRef }, "Delete user"),
                    React.createElement(ConfirmModal, { isOpen: showDeleteModal, title: "Delete user", body: "Are you sure you want to delete this user?", confirmText: "Delete user", onConfirm: handleUserDelete, onDismiss: showDeleteUserModal(false) }))),
                user.isDisabled && canEnable && (React.createElement(Button, { variant: "secondary", onClick: handleUserEnable }, "Enable user")),
                !user.isDisabled && canDisable && (React.createElement(React.Fragment, null,
                    React.createElement(Button, { variant: "secondary", onClick: showDisableUserModal(true), ref: disableUserRef }, "Disable user"),
                    React.createElement(ConfirmModal, { isOpen: showDisableModal, title: "Disable user", body: "Are you sure you want to disable this user?", confirmText: "Disable user", onConfirm: handleUserDisable, onDismiss: showDisableUserModal(false) })))))));
}
const styles = {
    buttonRow: css `
    margin-top: 0.8rem;
    > * {
      margin-right: 16px;
    }
  `,
};
export class UserProfileRow extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            editing: false,
            value: this.props.value || '',
        };
        this.setInputElem = (elem) => {
            this.inputElem = elem;
        };
        this.onEditClick = () => {
            if (this.props.inputType === 'password') {
                // Reset value for password field
                this.setState({ editing: true, value: '' }, this.focusInput);
            }
            else {
                this.setState({ editing: true }, this.focusInput);
            }
        };
        this.onCancelClick = () => {
            this.setState({ editing: false, value: this.props.value || '' });
        };
        this.onInputChange = (event, status) => {
            if (status === LegacyInputStatus.Invalid) {
                return;
            }
            this.setState({
                value: event.target.value,
            });
        };
        this.onInputBlur = (event, status) => {
            if (status === LegacyInputStatus.Invalid) {
                return;
            }
            this.setState({
                value: event.target.value,
            });
        };
        this.focusInput = () => {
            if (this.inputElem && this.inputElem.focus) {
                this.inputElem.focus();
            }
        };
        this.onSave = () => {
            if (this.props.onChange) {
                this.props.onChange(this.state.value);
            }
        };
    }
    render() {
        const { label, locked, lockMessage, inputType } = this.props;
        const { value } = this.state;
        const labelClass = cx('width-16', css `
        font-weight: 500;
      `);
        if (locked) {
            return React.createElement(LockedRow, { label: label, value: value, lockMessage: lockMessage });
        }
        const inputId = `${label}-input`;
        return (React.createElement("tr", null,
            React.createElement("td", { className: labelClass },
                React.createElement("label", { htmlFor: inputId }, label)),
            React.createElement("td", { className: "width-25", colSpan: 2 }, this.state.editing ? (React.createElement(Input, { id: inputId, type: inputType, defaultValue: value, onBlur: this.onInputBlur, onChange: this.onInputChange, ref: this.setInputElem, width: 30 })) : (React.createElement("span", null, this.props.value))),
            React.createElement("td", null,
                React.createElement(ConfirmButton, { confirmText: "Save", onClick: this.onEditClick, onConfirm: this.onSave, onCancel: this.onCancelClick }, "Edit"))));
    }
}
UserProfileRow.defaultProps = {
    value: '',
    locked: false,
    lockMessage: '',
    inputType: 'text',
};
export const LockedRow = ({ label, value, lockMessage }) => {
    const lockMessageClass = css `
    font-style: italic;
    margin-right: 0.6rem;
  `;
    const labelClass = cx('width-16', css `
      font-weight: 500;
    `);
    return (React.createElement("tr", null,
        React.createElement("td", { className: labelClass }, label),
        React.createElement("td", { className: "width-25", colSpan: 2 }, value),
        React.createElement("td", null,
            React.createElement("span", { className: lockMessageClass }, lockMessage))));
};
//# sourceMappingURL=UserProfile.js.map