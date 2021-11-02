import { __assign } from "tslib";
import React from 'react';
import { Tooltip, Form, Field, VerticalGroup, Button } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { submitButton } from '../Login/LoginForm';
import { PasswordField } from '../PasswordField/PasswordField';
export var ChangePassword = function (_a) {
    var onSubmit = _a.onSubmit, onSkip = _a.onSkip;
    var submit = function (passwords) {
        onSubmit(passwords.newPassword);
    };
    return (React.createElement(Form, { onSubmit: submit }, function (_a) {
        var _b, _c;
        var errors = _a.errors, register = _a.register, getValues = _a.getValues;
        return (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "New password", invalid: !!errors.newPassword, error: (_b = errors === null || errors === void 0 ? void 0 : errors.newPassword) === null || _b === void 0 ? void 0 : _b.message },
                React.createElement(PasswordField, __assign({ id: "new-password", autoFocus: true, autoComplete: "new-password" }, register('newPassword', { required: 'New Password is required' })))),
            React.createElement(Field, { label: "Confirm new password", invalid: !!errors.confirmNew, error: (_c = errors === null || errors === void 0 ? void 0 : errors.confirmNew) === null || _c === void 0 ? void 0 : _c.message },
                React.createElement(PasswordField, __assign({ id: "confirm-new-password", autoComplete: "new-password" }, register('confirmNew', {
                    required: 'Confirmed Password is required',
                    validate: function (v) { return v === getValues().newPassword || 'Passwords must match!'; },
                })))),
            React.createElement(VerticalGroup, null,
                React.createElement(Button, { type: "submit", className: submitButton }, "Submit"),
                onSkip && (React.createElement(Tooltip, { content: "If you skip you will be prompted to change password next time you log in.", placement: "bottom" },
                    React.createElement(Button, { fill: "text", onClick: onSkip, type: "button", "aria-label": selectors.pages.Login.skip }, "Skip"))))));
    }));
};
//# sourceMappingURL=ChangePassword.js.map