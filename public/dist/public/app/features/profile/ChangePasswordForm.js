import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Button, Field, Form, HorizontalGroup, LinkButton } from '@grafana/ui';
import config from 'app/core/config';
import { PasswordField } from '../../core/components/PasswordField/PasswordField';
export var ChangePasswordForm = function (_a) {
    var _b;
    var user = _a.user, onChangePassword = _a.onChangePassword, isSaving = _a.isSaving;
    var ldapEnabled = config.ldapEnabled, authProxyEnabled = config.authProxyEnabled, disableLoginForm = config.disableLoginForm;
    var authSource = ((_b = user.authLabels) === null || _b === void 0 ? void 0 : _b.length) && user.authLabels[0];
    if (ldapEnabled || authProxyEnabled) {
        return React.createElement("p", null, "You cannot change password when LDAP or auth proxy authentication is enabled.");
    }
    if (authSource && disableLoginForm) {
        return React.createElement("p", null, "Password cannot be changed here.");
    }
    return (React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        max-width: 400px;\n      "], ["\n        max-width: 400px;\n      "]))) },
        React.createElement(Form, { onSubmit: onChangePassword }, function (_a) {
            var _b, _c, _d;
            var register = _a.register, errors = _a.errors, getValues = _a.getValues;
            return (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Old password", invalid: !!errors.oldPassword, error: (_b = errors === null || errors === void 0 ? void 0 : errors.oldPassword) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(PasswordField, __assign({ id: "current-password", autoComplete: "current-password" }, register('oldPassword', { required: 'Old password is required' })))),
                React.createElement(Field, { label: "New password", invalid: !!errors.newPassword, error: (_c = errors === null || errors === void 0 ? void 0 : errors.newPassword) === null || _c === void 0 ? void 0 : _c.message },
                    React.createElement(PasswordField, __assign({ id: "new-password", autoComplete: "new-password" }, register('newPassword', {
                        required: 'New password is required',
                        validate: {
                            confirm: function (v) { return v === getValues().confirmNew || 'Passwords must match'; },
                            old: function (v) { return v !== getValues().oldPassword || "New password can't be the same as the old one."; },
                        },
                    })))),
                React.createElement(Field, { label: "Confirm password", invalid: !!errors.confirmNew, error: (_d = errors === null || errors === void 0 ? void 0 : errors.confirmNew) === null || _d === void 0 ? void 0 : _d.message },
                    React.createElement(PasswordField, __assign({ id: "confirm-new-password", autoComplete: "new-password" }, register('confirmNew', {
                        required: 'New password confirmation is required',
                        validate: function (v) { return v === getValues().newPassword || 'Passwords must match'; },
                    })))),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { variant: "primary", disabled: isSaving }, "Change Password"),
                    React.createElement(LinkButton, { variant: "secondary", href: config.appSubUrl + "/profile", fill: "outline" }, "Cancel"))));
        })));
};
var templateObject_1;
//# sourceMappingURL=ChangePasswordForm.js.map