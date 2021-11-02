import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { Form, Field, Input, Button, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { AppEvents } from '@grafana/data';
import { InnerBox, LoginLayout } from '../Login/LoginLayout';
import { PasswordField } from '../PasswordField/PasswordField';
export var SignupPage = function (props) {
    var onSubmit = function (formData) { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (formData.name === '') {
                        delete formData.name;
                    }
                    delete formData.confirm;
                    return [4 /*yield*/, getBackendSrv()
                            .post('/api/user/signup/step2', {
                            email: formData.email,
                            code: formData.code,
                            username: formData.email,
                            orgName: formData.orgName,
                            password: formData.password,
                            name: formData.name,
                        })
                            .catch(function (err) {
                            var _a;
                            var msg = ((_a = err.data) === null || _a === void 0 ? void 0 : _a.message) || err;
                            appEvents.emit(AppEvents.alertWarning, [msg]);
                        })];
                case 1:
                    response = _a.sent();
                    if (response.code === 'redirect-to-select-org') {
                        window.location.assign(getConfig().appSubUrl + '/profile/select-org?signup=1');
                    }
                    window.location.assign(getConfig().appSubUrl + '/');
                    return [2 /*return*/];
            }
        });
    }); };
    var defaultValues = {
        email: props.queryParams.email,
        code: props.queryParams.code,
    };
    return (React.createElement(LoginLayout, null,
        React.createElement(InnerBox, null,
            React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit }, function (_a) {
                var _b, _c, _d;
                var errors = _a.errors, register = _a.register, getValues = _a.getValues;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Your name" },
                        React.createElement(Input, __assign({ id: "user-name" }, register('name'), { placeholder: "(optional)" }))),
                    React.createElement(Field, { label: "Email", invalid: !!errors.email, error: (_b = errors.email) === null || _b === void 0 ? void 0 : _b.message },
                        React.createElement(Input, __assign({ id: "email" }, register('email', {
                            required: 'Email is required',
                            pattern: {
                                value: /^\S+@\S+$/,
                                message: 'Email is invalid',
                            },
                        }), { type: "email", placeholder: "Email" }))),
                    !getConfig().autoAssignOrg && (React.createElement(Field, { label: "Org. name" },
                        React.createElement(Input, __assign({ id: "org-name" }, register('orgName'), { placeholder: "Org. name" })))),
                    getConfig().verifyEmailEnabled && (React.createElement(Field, { label: "Email verification code (sent to your email)" },
                        React.createElement(Input, __assign({ id: "verification-code" }, register('code'), { placeholder: "Code" })))),
                    React.createElement(Field, { label: "Password", invalid: !!errors.password, error: (_c = errors === null || errors === void 0 ? void 0 : errors.password) === null || _c === void 0 ? void 0 : _c.message },
                        React.createElement(PasswordField, __assign({ id: "new-password", autoFocus: true, autoComplete: "new-password" }, register('password', { required: 'Password is required' })))),
                    React.createElement(Field, { label: "Confirm password", invalid: !!errors.confirm, error: (_d = errors === null || errors === void 0 ? void 0 : errors.confirm) === null || _d === void 0 ? void 0 : _d.message },
                        React.createElement(PasswordField, __assign({ id: "confirm-new-password", autoComplete: "new-password" }, register('confirm', {
                            required: 'Confirmed password is required',
                            validate: function (v) { return v === getValues().password || 'Passwords must match!'; },
                        })))),
                    React.createElement(HorizontalGroup, null,
                        React.createElement(Button, { type: "submit" }, "Submit"),
                        React.createElement(LinkButton, { fill: "text", href: getConfig().appSubUrl + '/login' }, "Back to login"))));
            }))));
};
export default SignupPage;
//# sourceMappingURL=SignupPage.js.map