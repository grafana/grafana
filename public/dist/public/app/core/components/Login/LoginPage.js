// Libraries
import { css } from '@emotion/css';
import React from 'react';
// Components
import { Alert, HorizontalGroup, LinkButton } from '@grafana/ui';
import { Branding } from 'app/core/components/Branding/Branding';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
import { ChangePassword } from '../ForgottenPassword/ChangePassword';
import LoginCtrl from './LoginCtrl';
import { LoginForm } from './LoginForm';
import { LoginLayout, InnerBox } from './LoginLayout';
import { LoginServiceButtons } from './LoginServiceButtons';
import { UserSignup } from './UserSignup';
const forgottenPasswordStyles = css `
  padding: 0;
  margin-top: 4px;
`;
const alertStyles = css({
    width: '100%',
});
export const LoginPage = () => {
    document.title = Branding.AppTitle;
    return (React.createElement(LoginCtrl, null, ({ loginHint, passwordHint, disableLoginForm, disableUserSignUp, login, isLoggingIn, changePassword, skipPasswordChange, isChangingPassword, showDefaultPasswordWarning, loginErrorMessage, }) => (React.createElement(LoginLayout, { isChangingPassword: isChangingPassword },
        !isChangingPassword && (React.createElement(InnerBox, null,
            loginErrorMessage && (React.createElement(Alert, { className: alertStyles, severity: "error", title: t('login.error.title', 'Login failed') }, loginErrorMessage)),
            !disableLoginForm && (React.createElement(LoginForm, { onSubmit: login, loginHint: loginHint, passwordHint: passwordHint, isLoggingIn: isLoggingIn },
                React.createElement(HorizontalGroup, { justify: "flex-end" },
                    React.createElement(LinkButton, { className: forgottenPasswordStyles, fill: "text", href: `${config.appSubUrl}/user/password/send-reset-email` }, "Forgot your password?")))),
            React.createElement(LoginServiceButtons, null),
            !disableUserSignUp && React.createElement(UserSignup, null))),
        isChangingPassword && (React.createElement(InnerBox, null,
            React.createElement(ChangePassword, { showDefaultPasswordWarning: showDefaultPasswordWarning, onSubmit: changePassword, onSkip: () => skipPasswordChange() })))))));
};
//# sourceMappingURL=LoginPage.js.map