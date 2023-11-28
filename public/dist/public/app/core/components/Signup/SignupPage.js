import { __awaiter } from "tslib";
import React from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { w3cStandardEmailValidator } from 'app/features/admin/utils';
import { InnerBox, LoginLayout } from '../Login/LoginLayout';
import { PasswordField } from '../PasswordField/PasswordField';
export const SignupPage = (props) => {
    const notifyApp = useAppNotification();
    const onSubmit = (formData) => __awaiter(void 0, void 0, void 0, function* () {
        if (formData.name === '') {
            delete formData.name;
        }
        delete formData.confirm;
        const response = yield getBackendSrv()
            .post('/api/user/signup/step2', {
            email: formData.email,
            code: formData.code,
            username: formData.email,
            orgName: formData.orgName,
            password: formData.password,
            name: formData.name,
        })
            .catch((err) => {
            var _a;
            const msg = ((_a = err.data) === null || _a === void 0 ? void 0 : _a.message) || err;
            notifyApp.warning(msg);
        });
        if (response.code === 'redirect-to-select-org') {
            window.location.assign(getConfig().appSubUrl + '/profile/select-org?signup=1');
        }
        window.location.assign(getConfig().appSubUrl + '/');
    });
    const defaultValues = {
        email: props.queryParams.email,
        code: props.queryParams.code,
    };
    return (React.createElement(LoginLayout, null,
        React.createElement(InnerBox, null,
            React.createElement(Form, { defaultValues: defaultValues, onSubmit: onSubmit }, ({ errors, register, getValues }) => {
                var _a, _b, _c;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Your name" },
                        React.createElement(Input, Object.assign({ id: "user-name" }, register('name'), { placeholder: "(optional)" }))),
                    React.createElement(Field, { label: "Email", invalid: !!errors.email, error: (_a = errors.email) === null || _a === void 0 ? void 0 : _a.message },
                        React.createElement(Input, Object.assign({ id: "email" }, register('email', {
                            required: 'Email is required',
                            pattern: {
                                value: w3cStandardEmailValidator,
                                message: 'Email is invalid',
                            },
                        }), { type: "email", placeholder: "Email" }))),
                    !getConfig().autoAssignOrg && (React.createElement(Field, { label: "Org. name" },
                        React.createElement(Input, Object.assign({ id: "org-name" }, register('orgName'), { placeholder: "Org. name" })))),
                    getConfig().verifyEmailEnabled && (React.createElement(Field, { label: "Email verification code (sent to your email)" },
                        React.createElement(Input, Object.assign({ id: "verification-code" }, register('code'), { placeholder: "Code" })))),
                    React.createElement(Field, { label: "Password", invalid: !!errors.password, error: (_b = errors === null || errors === void 0 ? void 0 : errors.password) === null || _b === void 0 ? void 0 : _b.message },
                        React.createElement(PasswordField, Object.assign({ id: "new-password", autoFocus: true, autoComplete: "new-password" }, register('password', { required: 'Password is required' })))),
                    React.createElement(Field, { label: "Confirm password", invalid: !!errors.confirm, error: (_c = errors === null || errors === void 0 ? void 0 : errors.confirm) === null || _c === void 0 ? void 0 : _c.message },
                        React.createElement(PasswordField, Object.assign({ id: "confirm-new-password", autoComplete: "new-password" }, register('confirm', {
                            required: 'Confirmed password is required',
                            validate: (v) => v === getValues().password || 'Passwords must match!',
                        })))),
                    React.createElement(HorizontalGroup, null,
                        React.createElement(Button, { type: "submit" }, "Submit"),
                        React.createElement(LinkButton, { fill: "text", href: getConfig().appSubUrl + '/login' }, "Back to login"))));
            }))));
};
export default SignupPage;
//# sourceMappingURL=SignupPage.js.map