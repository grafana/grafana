import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { AccessControlAction } from 'app/types';
import { css, cx } from '@emotion/css';
import { config } from 'app/core/config';
import { Button, ConfirmButton, ConfirmModal, Input, LegacyInputStatus, stylesFactory } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
var UserProfile = /** @class */ (function (_super) {
    __extends(UserProfile, _super);
    function UserProfile() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isLoading: false,
            showDeleteModal: false,
            showDisableModal: false,
        };
        _this.showDeleteUserModal = function (show) { return function () {
            _this.setState({ showDeleteModal: show });
        }; };
        _this.showDisableUserModal = function (show) { return function () {
            _this.setState({ showDisableModal: show });
        }; };
        _this.onUserDelete = function () {
            var _a = _this.props, user = _a.user, onUserDelete = _a.onUserDelete;
            onUserDelete(user.id);
        };
        _this.onUserDisable = function () {
            var _a = _this.props, user = _a.user, onUserDisable = _a.onUserDisable;
            onUserDisable(user.id);
        };
        _this.onUserEnable = function () {
            var _a = _this.props, user = _a.user, onUserEnable = _a.onUserEnable;
            onUserEnable(user.id);
        };
        _this.onUserNameChange = function (newValue) {
            var _a = _this.props, user = _a.user, onUserUpdate = _a.onUserUpdate;
            onUserUpdate(__assign(__assign({}, user), { name: newValue }));
        };
        _this.onUserEmailChange = function (newValue) {
            var _a = _this.props, user = _a.user, onUserUpdate = _a.onUserUpdate;
            onUserUpdate(__assign(__assign({}, user), { email: newValue }));
        };
        _this.onUserLoginChange = function (newValue) {
            var _a = _this.props, user = _a.user, onUserUpdate = _a.onUserUpdate;
            onUserUpdate(__assign(__assign({}, user), { login: newValue }));
        };
        _this.onPasswordChange = function (newValue) {
            _this.props.onPasswordChange(newValue);
        };
        return _this;
    }
    UserProfile.prototype.render = function () {
        var _a;
        var user = this.props.user;
        var _b = this.state, showDeleteModal = _b.showDeleteModal, showDisableModal = _b.showDisableModal;
        var authSource = ((_a = user.authLabels) === null || _a === void 0 ? void 0 : _a.length) && user.authLabels[0];
        var lockMessage = authSource ? "Synced via " + authSource : '';
        var styles = getStyles(config.theme);
        var editLocked = user.isExternal || !contextSrv.hasPermission(AccessControlAction.UsersWrite);
        var passwordChangeLocked = user.isExternal || !contextSrv.hasPermission(AccessControlAction.UsersPasswordUpdate);
        var canDelete = contextSrv.hasPermission(AccessControlAction.UsersDelete);
        var canDisable = contextSrv.hasPermission(AccessControlAction.UsersDisable);
        var canEnable = contextSrv.hasPermission(AccessControlAction.UsersEnable);
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-heading" }, "User information"),
            React.createElement("div", { className: "gf-form-group" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("table", { className: "filter-table form-inline" },
                        React.createElement("tbody", null,
                            React.createElement(UserProfileRow, { label: "Name", value: user.name, locked: editLocked, lockMessage: lockMessage, onChange: this.onUserNameChange }),
                            React.createElement(UserProfileRow, { label: "Email", value: user.email, locked: editLocked, lockMessage: lockMessage, onChange: this.onUserEmailChange }),
                            React.createElement(UserProfileRow, { label: "Username", value: user.login, locked: editLocked, lockMessage: lockMessage, onChange: this.onUserLoginChange }),
                            React.createElement(UserProfileRow, { label: "Password", value: "********", inputType: "password", locked: passwordChangeLocked, lockMessage: lockMessage, onChange: this.onPasswordChange })))),
                React.createElement("div", { className: styles.buttonRow },
                    canDelete && (React.createElement(React.Fragment, null,
                        React.createElement(Button, { variant: "destructive", onClick: this.showDeleteUserModal(true) }, "Delete user"),
                        React.createElement(ConfirmModal, { isOpen: showDeleteModal, title: "Delete user", body: "Are you sure you want to delete this user?", confirmText: "Delete user", onConfirm: this.onUserDelete, onDismiss: this.showDeleteUserModal(false) }))),
                    user.isDisabled && canEnable && (React.createElement(Button, { variant: "secondary", onClick: this.onUserEnable }, "Enable user")),
                    !user.isDisabled && canDisable && (React.createElement(React.Fragment, null,
                        React.createElement(Button, { variant: "secondary", onClick: this.showDisableUserModal(true) }, "Disable user"),
                        React.createElement(ConfirmModal, { isOpen: showDisableModal, title: "Disable user", body: "Are you sure you want to disable this user?", confirmText: "Disable user", onConfirm: this.onUserDisable, onDismiss: this.showDisableUserModal(false) })))))));
    };
    return UserProfile;
}(PureComponent));
export { UserProfile };
var getStyles = stylesFactory(function (theme) {
    return {
        buttonRow: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: 0.8rem;\n      > * {\n        margin-right: 16px;\n      }\n    "], ["\n      margin-top: 0.8rem;\n      > * {\n        margin-right: 16px;\n      }\n    "]))),
    };
});
var UserProfileRow = /** @class */ (function (_super) {
    __extends(UserProfileRow, _super);
    function UserProfileRow() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            editing: false,
            value: _this.props.value || '',
        };
        _this.setInputElem = function (elem) {
            _this.inputElem = elem;
        };
        _this.onEditClick = function () {
            if (_this.props.inputType === 'password') {
                // Reset value for password field
                _this.setState({ editing: true, value: '' }, _this.focusInput);
            }
            else {
                _this.setState({ editing: true }, _this.focusInput);
            }
        };
        _this.onCancelClick = function () {
            _this.setState({ editing: false, value: _this.props.value || '' });
        };
        _this.onInputChange = function (event, status) {
            if (status === LegacyInputStatus.Invalid) {
                return;
            }
            _this.setState({ value: event.target.value });
        };
        _this.onInputBlur = function (event, status) {
            if (status === LegacyInputStatus.Invalid) {
                return;
            }
            _this.setState({ value: event.target.value });
        };
        _this.focusInput = function () {
            if (_this.inputElem && _this.inputElem.focus) {
                _this.inputElem.focus();
            }
        };
        _this.onSave = function () {
            if (_this.props.onChange) {
                _this.props.onChange(_this.state.value);
            }
        };
        return _this;
    }
    UserProfileRow.prototype.render = function () {
        var _a = this.props, label = _a.label, locked = _a.locked, lockMessage = _a.lockMessage, inputType = _a.inputType;
        var value = this.state.value;
        var labelClass = cx('width-16', css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        font-weight: 500;\n      "], ["\n        font-weight: 500;\n      "]))));
        var editButtonContainerClass = cx('pull-right');
        if (locked) {
            return React.createElement(LockedRow, { label: label, value: value, lockMessage: lockMessage });
        }
        return (React.createElement("tr", null,
            React.createElement("td", { className: labelClass }, label),
            React.createElement("td", { className: "width-25", colSpan: 2 }, this.state.editing ? (React.createElement(Input, { type: inputType, defaultValue: value, onBlur: this.onInputBlur, onChange: this.onInputChange, ref: this.setInputElem, width: 30 })) : (React.createElement("span", null, this.props.value))),
            React.createElement("td", null,
                React.createElement("div", { className: editButtonContainerClass },
                    React.createElement(ConfirmButton, { confirmText: "Save", onClick: this.onEditClick, onConfirm: this.onSave, onCancel: this.onCancelClick }, "Edit")))));
    };
    UserProfileRow.defaultProps = {
        value: '',
        locked: false,
        lockMessage: '',
        inputType: 'text',
    };
    return UserProfileRow;
}(PureComponent));
export { UserProfileRow };
export var LockedRow = function (_a) {
    var label = _a.label, value = _a.value, lockMessage = _a.lockMessage;
    var lockMessageClass = cx('pull-right', css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      font-style: italic;\n      margin-right: 0.6rem;\n    "], ["\n      font-style: italic;\n      margin-right: 0.6rem;\n    "]))));
    var labelClass = cx('width-16', css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      font-weight: 500;\n    "], ["\n      font-weight: 500;\n    "]))));
    return (React.createElement("tr", null,
        React.createElement("td", { className: labelClass }, label),
        React.createElement("td", { className: "width-25", colSpan: 2 }, value),
        React.createElement("td", null,
            React.createElement("span", { className: lockMessageClass }, lockMessage))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=UserProfile.js.map