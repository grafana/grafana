import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, Form, Field, VerticalGroup, Button, Alert } from '@grafana/ui';
import { submitButton } from '../Login/LoginForm';
import { PasswordField } from '../PasswordField/PasswordField';
export const ChangePassword = ({ onSubmit, onSkip, showDefaultPasswordWarning }) => {
    const submit = (passwords) => {
        onSubmit(passwords.newPassword);
    };
    return (React.createElement(Form, { onSubmit: submit }, ({ errors, register, getValues }) => {
        var _a, _b;
        return (React.createElement(React.Fragment, null,
            showDefaultPasswordWarning && (React.createElement(Alert, { severity: "info", title: "Continuing to use the default password exposes you to security risks." })),
            React.createElement(Field, { label: "New password", invalid: !!errors.newPassword, error: (_a = errors === null || errors === void 0 ? void 0 : errors.newPassword) === null || _a === void 0 ? void 0 : _a.message },
                React.createElement(PasswordField, Object.assign({ id: "new-password", autoFocus: true, autoComplete: "new-password" }, register('newPassword', { required: 'New Password is required' })))),
            React.createElement(Field, { label: "Confirm new password", invalid: !!errors.confirmNew, error: (_b = errors === null || errors === void 0 ? void 0 : errors.confirmNew) === null || _b === void 0 ? void 0 : _b.message },
                React.createElement(PasswordField, Object.assign({ id: "confirm-new-password", autoComplete: "new-password" }, register('confirmNew', {
                    required: 'Confirmed Password is required',
                    validate: (v) => v === getValues().newPassword || 'Passwords must match!',
                })))),
            React.createElement(VerticalGroup, null,
                React.createElement(Button, { type: "submit", className: submitButton }, "Submit"),
                onSkip && (React.createElement(Tooltip, { content: "If you skip you will be prompted to change password next time you log in.", placement: "bottom" },
                    React.createElement(Button, { fill: "text", onClick: onSkip, type: "button", "aria-label": selectors.pages.Login.skip }, "Skip"))))));
    }));
};
//# sourceMappingURL=ChangePassword.js.map