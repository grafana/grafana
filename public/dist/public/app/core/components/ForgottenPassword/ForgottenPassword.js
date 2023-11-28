import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, Legend, Container, useStyles2, HorizontalGroup, LinkButton } from '@grafana/ui';
import config from 'app/core/config';
const paragraphStyles = (theme) => css `
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.bodySmall.fontSize};
  font-weight: ${theme.typography.fontWeightRegular};
  margin-top: ${theme.spacing(1)};
  display: block;
`;
export const ForgottenPassword = () => {
    const [emailSent, setEmailSent] = useState(false);
    const styles = useStyles2(paragraphStyles);
    const loginHref = `${config.appSubUrl}/login`;
    const sendEmail = (formModel) => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield getBackendSrv().post('/api/user/password/send-reset-email', formModel);
        if (res) {
            setEmailSent(true);
        }
    });
    if (emailSent) {
        return (React.createElement("div", null,
            React.createElement("p", null, "An email with a reset link has been sent to the email address. You should receive it shortly."),
            React.createElement(Container, { margin: "md" }),
            React.createElement(LinkButton, { variant: "primary", href: loginHref }, "Back to login")));
    }
    return (React.createElement(Form, { onSubmit: sendEmail }, ({ register, errors }) => {
        var _a;
        return (React.createElement(React.Fragment, null,
            React.createElement(Legend, null, "Reset password"),
            React.createElement(Field, { label: "User", description: "Enter your information to get a reset link sent to you", invalid: !!errors.userOrEmail, error: (_a = errors === null || errors === void 0 ? void 0 : errors.userOrEmail) === null || _a === void 0 ? void 0 : _a.message },
                React.createElement(Input, Object.assign({ id: "user-input", placeholder: "Email or username" }, register('userOrEmail', { required: 'Email or username is required' })))),
            React.createElement(HorizontalGroup, null,
                React.createElement(Button, { type: "submit" }, "Send reset email"),
                React.createElement(LinkButton, { fill: "text", href: loginHref }, "Back to login")),
            React.createElement("p", { className: styles }, "Did you forget your username or email? Contact your Grafana administrator.")));
    }));
};
//# sourceMappingURL=ForgottenPassword.js.map