import React, { useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, Legend, Container, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { w3cStandardEmailValidator } from 'app/features/admin/utils';
export const VerifyEmail = () => {
    const notifyApp = useAppNotification();
    const [emailSent, setEmailSent] = useState(false);
    const onSubmit = (formModel) => {
        getBackendSrv()
            .post('/api/user/signup', formModel)
            .then(() => {
            setEmailSent(true);
        })
            .catch((err) => {
            var _a;
            const msg = ((_a = err.data) === null || _a === void 0 ? void 0 : _a.message) || err;
            notifyApp.warning(msg);
        });
    };
    if (emailSent) {
        return (React.createElement("div", null,
            React.createElement("p", null, "An email with a verification link has been sent to the email address. You should receive it shortly."),
            React.createElement(Container, { margin: "md" }),
            React.createElement(LinkButton, { variant: "primary", href: getConfig().appSubUrl + '/signup' }, "Complete Signup")));
    }
    return (React.createElement(Form, { onSubmit: onSubmit }, ({ register, errors }) => {
        var _a;
        return (React.createElement(React.Fragment, null,
            React.createElement(Legend, null, "Verify Email"),
            React.createElement(Field, { label: "Email", description: "Enter your email address to get a verification link sent to you", invalid: !!errors.email, error: (_a = errors.email) === null || _a === void 0 ? void 0 : _a.message },
                React.createElement(Input, Object.assign({ id: "email" }, register('email', {
                    required: 'Email is required',
                    pattern: {
                        value: w3cStandardEmailValidator,
                        message: 'Email is invalid',
                    },
                }), { placeholder: "Email" }))),
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, { type: "submit" }, "Send verification email"),
                React.createElement(LinkButton, { fill: "text", href: getConfig().appSubUrl + '/login' }, "Back to login"))));
    }));
};
//# sourceMappingURL=VerifyEmail.js.map