import { css } from '@emotion/css';
import React from 'react';
import { Button, Field, Form, HorizontalGroup, LinkButton } from '@grafana/ui';
import config from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';
import { PasswordField } from '../../core/components/PasswordField/PasswordField';
export const ChangePasswordForm = ({ user, onChangePassword, isSaving }) => {
    var _a;
    const { disableLoginForm } = config;
    const authSource = ((_a = user.authLabels) === null || _a === void 0 ? void 0 : _a.length) && user.authLabels[0];
    if (authSource === 'LDAP' || authSource === 'Auth Proxy') {
        return (React.createElement("p", null,
            React.createElement(Trans, { i18nKey: "profile.change-password.ldap-auth-proxy-message" }, "You cannot change password when signed in with LDAP or auth proxy.")));
    }
    if (authSource && disableLoginForm) {
        return (React.createElement("p", null,
            React.createElement(Trans, { i18nKey: "profile.change-password.cannot-change-password-message" }, "Password cannot be changed here.")));
    }
    return (React.createElement("div", { className: css `
        max-width: 400px;
      ` },
        React.createElement(Form, { onSubmit: onChangePassword }, ({ register, errors, getValues }) => {
            var _a, _b, _c;
            return (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: t('profile.change-password.old-password-label', 'Old password'), invalid: !!errors.oldPassword, error: (_a = errors === null || errors === void 0 ? void 0 : errors.oldPassword) === null || _a === void 0 ? void 0 : _a.message },
                    React.createElement(PasswordField, Object.assign({ id: "current-password", autoComplete: "current-password" }, register('oldPassword', {
                        required: t('profile.change-password.old-password-required', 'Old password is required'),
                    })))),
                React.createElement(Field, { label: t('profile.change-password.new-password-label', 'New password'), invalid: !!errors.newPassword, error: (_b = errors === null || errors === void 0 ? void 0 : errors.newPassword) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(PasswordField, Object.assign({ id: "new-password", autoComplete: "new-password" }, register('newPassword', {
                        required: t('profile.change-password.new-password-required', 'New password is required'),
                        validate: {
                            confirm: (v) => v === getValues().confirmNew ||
                                t('profile.change-password.passwords-must-match', 'Passwords must match'),
                            old: (v) => v !== getValues().oldPassword ||
                                t('profile.change-password.new-password-same-as-old', "New password can't be the same as the old one."),
                        },
                    })))),
                React.createElement(Field, { label: t('profile.change-password.confirm-password-label', 'Confirm password'), invalid: !!errors.confirmNew, error: (_c = errors === null || errors === void 0 ? void 0 : errors.confirmNew) === null || _c === void 0 ? void 0 : _c.message },
                    React.createElement(PasswordField, Object.assign({ id: "confirm-new-password", autoComplete: "new-password" }, register('confirmNew', {
                        required: t('profile.change-password.confirm-password-required', 'New password confirmation is required'),
                        validate: (v) => v === getValues().newPassword ||
                            t('profile.change-password.passwords-must-match', 'Passwords must match'),
                    })))),
                React.createElement(HorizontalGroup, null,
                    React.createElement(Button, { variant: "primary", disabled: isSaving, type: "submit" },
                        React.createElement(Trans, { i18nKey: "profile.change-password.change-password-button" }, "Change Password")),
                    React.createElement(LinkButton, { variant: "secondary", href: `${config.appSubUrl}/profile`, fill: "outline" },
                        React.createElement(Trans, { i18nKey: "profile.change-password.cancel-button" }, "Cancel")))));
        })));
};
//# sourceMappingURL=ChangePasswordForm.js.map