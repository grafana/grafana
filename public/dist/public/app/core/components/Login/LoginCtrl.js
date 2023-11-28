import React, { PureComponent } from 'react';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
const isOauthEnabled = () => {
    return !!config.oauth && Object.keys(config.oauth).length > 0;
};
export class LoginCtrl extends PureComponent {
    constructor(props) {
        super(props);
        this.changePassword = (password) => {
            const pw = {
                newPassword: password,
                confirmNew: password,
                oldPassword: 'admin',
            };
            if (this.props.resetCode) {
                const resetModel = {
                    code: this.props.resetCode,
                    newPassword: password,
                    confirmPassword: password,
                };
                getBackendSrv()
                    .post('/api/user/password/reset', resetModel)
                    .then(() => {
                    this.toGrafana();
                });
            }
            else {
                getBackendSrv()
                    .put('/api/user/password', pw)
                    .then(() => {
                    this.toGrafana();
                })
                    .catch((err) => console.error(err));
            }
        };
        this.login = (formModel) => {
            this.setState({
                loginErrorMessage: undefined,
                isLoggingIn: true,
            });
            getBackendSrv()
                .post('/login', formModel, { showErrorAlert: false })
                .then((result) => {
                this.result = result;
                if (formModel.password !== 'admin' || config.ldapEnabled || config.authProxyEnabled) {
                    this.toGrafana();
                    return;
                }
                else {
                    this.changeView(formModel.password === 'admin');
                }
            })
                .catch((err) => {
                const fetchErrorMessage = isFetchError(err) ? getErrorMessage(err) : undefined;
                this.setState({
                    isLoggingIn: false,
                    loginErrorMessage: fetchErrorMessage || t('login.error.unknown', 'Unknown error occurred'),
                });
            });
        };
        this.changeView = (showDefaultPasswordWarning) => {
            this.setState({
                isChangingPassword: true,
                showDefaultPasswordWarning,
            });
        };
        this.toGrafana = () => {
            var _a;
            // Use window.location.href to force page reload
            if ((_a = this.result) === null || _a === void 0 ? void 0 : _a.redirectUrl) {
                if (config.appSubUrl !== '' && !this.result.redirectUrl.startsWith(config.appSubUrl)) {
                    window.location.assign(config.appSubUrl + this.result.redirectUrl);
                }
                else {
                    window.location.assign(this.result.redirectUrl);
                }
            }
            else {
                window.location.assign(config.appSubUrl + '/');
            }
        };
        this.state = {
            isLoggingIn: false,
            isChangingPassword: false,
            showDefaultPasswordWarning: false,
            loginErrorMessage: config.loginError,
        };
    }
    render() {
        const { children } = this.props;
        const { isLoggingIn, isChangingPassword, showDefaultPasswordWarning, loginErrorMessage } = this.state;
        const { login, toGrafana, changePassword } = this;
        const { loginHint, passwordHint, disableLoginForm, disableUserSignUp } = config;
        return (React.createElement(React.Fragment, null, children({
            isOauthEnabled: isOauthEnabled(),
            loginHint,
            passwordHint,
            disableLoginForm,
            disableUserSignUp,
            login,
            isLoggingIn,
            changePassword,
            skipPasswordChange: toGrafana,
            isChangingPassword,
            showDefaultPasswordWarning,
            loginErrorMessage,
        })));
    }
}
export default LoginCtrl;
function getErrorMessage(err) {
    var _a, _b;
    switch ((_a = err.data) === null || _a === void 0 ? void 0 : _a.messageId) {
        case 'password-auth.empty':
        case 'password-auth.failed':
        case 'password-auth.invalid':
            return t('login.error.invalid-user-or-password', 'Invalid username or password');
        case 'login-attempt.blocked':
            return t('login.error.blocked', 'You have exceeded the number of login attempts for this user. Please try again later.');
        default:
            return (_b = err.data) === null || _b === void 0 ? void 0 : _b.message;
    }
}
//# sourceMappingURL=LoginCtrl.js.map