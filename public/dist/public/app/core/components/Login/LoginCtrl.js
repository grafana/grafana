import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import config from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { AppEvents } from '@grafana/data';
var isOauthEnabled = function () {
    return !!config.oauth && Object.keys(config.oauth).length > 0;
};
var LoginCtrl = /** @class */ (function (_super) {
    __extends(LoginCtrl, _super);
    function LoginCtrl(props) {
        var _this = _super.call(this, props) || this;
        _this.result = {};
        _this.changePassword = function (password) {
            var pw = {
                newPassword: password,
                confirmNew: password,
                oldPassword: 'admin',
            };
            if (!_this.props.resetCode) {
                getBackendSrv()
                    .put('/api/user/password', pw)
                    .then(function () {
                    _this.toGrafana();
                })
                    .catch(function (err) { return console.error(err); });
            }
            var resetModel = {
                code: _this.props.resetCode,
                newPassword: password,
                confirmPassword: password,
            };
            getBackendSrv()
                .post('/api/user/password/reset', resetModel)
                .then(function () {
                _this.toGrafana();
            });
        };
        _this.login = function (formModel) {
            _this.setState({
                isLoggingIn: true,
            });
            getBackendSrv()
                .post('/login', formModel)
                .then(function (result) {
                _this.result = result;
                if (formModel.password !== 'admin' || config.ldapEnabled || config.authProxyEnabled) {
                    _this.toGrafana();
                    return;
                }
                else {
                    _this.changeView();
                }
            })
                .catch(function () {
                _this.setState({
                    isLoggingIn: false,
                });
            });
        };
        _this.changeView = function () {
            _this.setState({
                isChangingPassword: true,
            });
        };
        _this.toGrafana = function () {
            // Use window.location.href to force page reload
            if (_this.result.redirectUrl) {
                if (config.appSubUrl !== '' && !_this.result.redirectUrl.startsWith(config.appSubUrl)) {
                    window.location.assign(config.appSubUrl + _this.result.redirectUrl);
                }
                else {
                    window.location.assign(_this.result.redirectUrl);
                }
            }
            else {
                window.location.assign(config.appSubUrl + '/');
            }
        };
        _this.state = {
            isLoggingIn: false,
            isChangingPassword: false,
        };
        if (config.loginError) {
            appEvents.emit(AppEvents.alertWarning, ['Login Failed', config.loginError]);
        }
        return _this;
    }
    LoginCtrl.prototype.render = function () {
        var children = this.props.children;
        var _a = this.state, isLoggingIn = _a.isLoggingIn, isChangingPassword = _a.isChangingPassword;
        var _b = this, login = _b.login, toGrafana = _b.toGrafana, changePassword = _b.changePassword;
        var loginHint = config.loginHint, passwordHint = config.passwordHint, disableLoginForm = config.disableLoginForm, ldapEnabled = config.ldapEnabled, authProxyEnabled = config.authProxyEnabled, disableUserSignUp = config.disableUserSignUp;
        return (React.createElement(React.Fragment, null, children({
            isOauthEnabled: isOauthEnabled(),
            loginHint: loginHint,
            passwordHint: passwordHint,
            disableLoginForm: disableLoginForm,
            ldapEnabled: ldapEnabled,
            authProxyEnabled: authProxyEnabled,
            disableUserSignUp: disableUserSignUp,
            login: login,
            isLoggingIn: isLoggingIn,
            changePassword: changePassword,
            skipPasswordChange: toGrafana,
            isChangingPassword: isChangingPassword,
        })));
    };
    return LoginCtrl;
}(PureComponent));
export { LoginCtrl };
export default LoginCtrl;
//# sourceMappingURL=LoginCtrl.js.map