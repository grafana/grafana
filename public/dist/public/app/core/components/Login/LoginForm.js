import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Form, Input, Field } from '@grafana/ui';
import { PasswordField } from '../PasswordField/PasswordField';
const wrapperStyles = css `
  width: 100%;
  padding-bottom: 16px;
`;
export const submitButton = css `
  justify-content: center;
  width: 100%;
`;
export const LoginForm = ({ children, onSubmit, isLoggingIn, passwordHint, loginHint }) => {
    return (React.createElement("div", { className: wrapperStyles },
        React.createElement(Form, { onSubmit: onSubmit, validateOn: "onChange" }, ({ register, errors }) => {
            var _a, _b;
            return (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Email or username", invalid: !!errors.user, error: (_a = errors.user) === null || _a === void 0 ? void 0 : _a.message },
                    React.createElement(Input, Object.assign({}, register('user', { required: 'Email or username is required' }), { autoFocus: true, autoCapitalize: "none", placeholder: loginHint, "aria-label": selectors.pages.Login.username }))),
                React.createElement(Field, { label: "Password", invalid: !!errors.password, error: (_b = errors.password) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(PasswordField, Object.assign({ id: "current-password", autoComplete: "current-password", passwordHint: passwordHint }, register('password', { required: 'Password is required' })))),
                React.createElement(Button, { type: "submit", "aria-label": selectors.pages.Login.submit, className: submitButton, disabled: isLoggingIn }, isLoggingIn ? 'Logging in...' : 'Log in'),
                children));
        })));
};
//# sourceMappingURL=LoginForm.js.map