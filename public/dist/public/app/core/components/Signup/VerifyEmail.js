import { __assign, __read } from "tslib";
import React, { useState } from 'react';
import { Form, Field, Input, Button, Legend, Container, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { AppEvents } from '@grafana/data';
export var VerifyEmail = function () {
    var _a = __read(useState(false), 2), emailSent = _a[0], setEmailSent = _a[1];
    var onSubmit = function (formModel) {
        getBackendSrv()
            .post('/api/user/signup', formModel)
            .then(function () {
            setEmailSent(true);
        })
            .catch(function (err) {
            var _a;
            var msg = ((_a = err.data) === null || _a === void 0 ? void 0 : _a.message) || err;
            appEvents.emit(AppEvents.alertWarning, [msg]);
        });
    };
    if (emailSent) {
        return (React.createElement("div", null,
            React.createElement("p", null, "An email with a verification link has been sent to the email address. You should receive it shortly."),
            React.createElement(Container, { margin: "md" }),
            React.createElement(LinkButton, { variant: "primary", href: getConfig().appSubUrl + '/signup' }, "Complete Signup")));
    }
    return (React.createElement(Form, { onSubmit: onSubmit }, function (_a) {
        var _b;
        var register = _a.register, errors = _a.errors;
        return (React.createElement(React.Fragment, null,
            React.createElement(Legend, null, "Verify Email"),
            React.createElement(Field, { label: "Email", description: "Enter your email address to get a verification link sent to you", invalid: !!errors.email, error: (_b = errors.email) === null || _b === void 0 ? void 0 : _b.message },
                React.createElement(Input, __assign({ id: "email" }, register('email', {
                    required: 'Email is required',
                    pattern: {
                        value: /^\S+@\S+$/,
                        message: 'Email is invalid',
                    },
                }), { placeholder: "Email" }))),
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, null, "Send verification email"),
                React.createElement(LinkButton, { fill: "text", href: getConfig().appSubUrl + '/login' }, "Back to login"))));
    }));
};
//# sourceMappingURL=VerifyEmail.js.map