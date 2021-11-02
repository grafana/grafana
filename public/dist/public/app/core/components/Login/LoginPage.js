import { __makeTemplateObject } from "tslib";
// Libraries
import React from 'react';
import { css } from '@emotion/css';
// Components
import { UserSignup } from './UserSignup';
import { LoginServiceButtons } from './LoginServiceButtons';
import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { ChangePassword } from '../ForgottenPassword/ChangePassword';
import { Branding } from 'app/core/components/Branding/Branding';
import { HorizontalGroup, LinkButton } from '@grafana/ui';
import { LoginLayout, InnerBox } from './LoginLayout';
import config from 'app/core/config';
var forgottenPasswordStyles = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  padding: 0;\n  margin-top: 4px;\n"], ["\n  padding: 0;\n  margin-top: 4px;\n"])));
export var LoginPage = function () {
    document.title = Branding.AppTitle;
    return (React.createElement(LoginLayout, null,
        React.createElement(LoginCtrl, null, function (_a) {
            var loginHint = _a.loginHint, passwordHint = _a.passwordHint, ldapEnabled = _a.ldapEnabled, authProxyEnabled = _a.authProxyEnabled, disableLoginForm = _a.disableLoginForm, disableUserSignUp = _a.disableUserSignUp, login = _a.login, isLoggingIn = _a.isLoggingIn, changePassword = _a.changePassword, skipPasswordChange = _a.skipPasswordChange, isChangingPassword = _a.isChangingPassword;
            return (React.createElement(React.Fragment, null,
                !isChangingPassword && (React.createElement(InnerBox, null,
                    !disableLoginForm && (React.createElement(LoginForm, { onSubmit: login, loginHint: loginHint, passwordHint: passwordHint, isLoggingIn: isLoggingIn }, !(ldapEnabled || authProxyEnabled) ? (React.createElement(HorizontalGroup, { justify: "flex-end" },
                        React.createElement(LinkButton, { className: forgottenPasswordStyles, fill: "text", href: config.appSubUrl + "/user/password/send-reset-email" }, "Forgot your password?"))) : (React.createElement(React.Fragment, null)))),
                    React.createElement(LoginServiceButtons, null),
                    !disableUserSignUp && React.createElement(UserSignup, null))),
                isChangingPassword && (React.createElement(InnerBox, null,
                    React.createElement(ChangePassword, { onSubmit: changePassword, onSkip: function () { return skipPasswordChange(); } })))));
        })));
};
var templateObject_1;
//# sourceMappingURL=LoginPage.js.map