import { __assign, __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { Form, Field, Input, Button, Legend, Container, useStyles, HorizontalGroup, LinkButton } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import config from 'app/core/config';
var paragraphStyles = function (theme) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  color: ", ";\n  font-size: ", ";\n  font-weight: ", ";\n  margin-top: ", ";\n  display: block;\n"], ["\n  color: ", ";\n  font-size: ", ";\n  font-weight: ", ";\n  margin-top: ", ";\n  display: block;\n"])), theme.colors.formDescription, theme.typography.size.sm, theme.typography.weight.regular, theme.spacing.sm); };
export var ForgottenPassword = function () {
    var _a = __read(useState(false), 2), emailSent = _a[0], setEmailSent = _a[1];
    var styles = useStyles(paragraphStyles);
    var loginHref = config.appSubUrl + "/login";
    var sendEmail = function (formModel) { return __awaiter(void 0, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/user/password/send-reset-email', formModel)];
                case 1:
                    res = _a.sent();
                    if (res) {
                        setEmailSent(true);
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    if (emailSent) {
        return (React.createElement("div", null,
            React.createElement("p", null, "An email with a reset link has been sent to the email address. You should receive it shortly."),
            React.createElement(Container, { margin: "md" }),
            React.createElement(LinkButton, { variant: "primary", href: loginHref }, "Back to login")));
    }
    return (React.createElement(Form, { onSubmit: sendEmail }, function (_a) {
        var _b;
        var register = _a.register, errors = _a.errors;
        return (React.createElement(React.Fragment, null,
            React.createElement(Legend, null, "Reset password"),
            React.createElement(Field, { label: "User", description: "Enter your information to get a reset link sent to you", invalid: !!errors.userOrEmail, error: (_b = errors === null || errors === void 0 ? void 0 : errors.userOrEmail) === null || _b === void 0 ? void 0 : _b.message },
                React.createElement(Input, __assign({ id: "user-input", placeholder: "Email or username" }, register('userOrEmail', { required: 'Email or username is required' })))),
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, null, "Send reset email"),
                React.createElement(LinkButton, { fill: "text", href: loginHref }, "Back to login")),
            React.createElement("p", { className: styles }, "Did you forget your username or email? Contact your Grafana administrator.")));
    }));
};
var templateObject_1;
//# sourceMappingURL=ForgottenPassword.js.map