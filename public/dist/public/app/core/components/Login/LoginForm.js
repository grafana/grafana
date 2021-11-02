import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Form, Input, Field } from '@grafana/ui';
import { css } from '@emotion/css';
import { PasswordField } from '../PasswordField/PasswordField';
var wrapperStyles = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  width: 100%;\n  padding-bottom: 16px;\n"], ["\n  width: 100%;\n  padding-bottom: 16px;\n"])));
export var submitButton = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  justify-content: center;\n  width: 100%;\n"], ["\n  justify-content: center;\n  width: 100%;\n"])));
export var LoginForm = function (_a) {
    var children = _a.children, onSubmit = _a.onSubmit, isLoggingIn = _a.isLoggingIn, passwordHint = _a.passwordHint, loginHint = _a.loginHint;
    return (React.createElement("div", { className: wrapperStyles },
        React.createElement(Form, { onSubmit: onSubmit, validateOn: "onChange" }, function (_a) {
            var _b, _c;
            var register = _a.register, errors = _a.errors;
            return (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Email or username", invalid: !!errors.user, error: (_b = errors.user) === null || _b === void 0 ? void 0 : _b.message },
                    React.createElement(Input, __assign({}, register('user', { required: 'Email or username is required' }), { autoFocus: true, autoCapitalize: "none", placeholder: loginHint, "aria-label": selectors.pages.Login.username }))),
                React.createElement(Field, { label: "Password", invalid: !!errors.password, error: (_c = errors.password) === null || _c === void 0 ? void 0 : _c.message },
                    React.createElement(PasswordField, __assign({ id: "current-password", autoComplete: "current-password", passwordHint: passwordHint }, register('password', { required: 'Password is required' })))),
                React.createElement(Button, { "aria-label": selectors.pages.Login.submit, className: submitButton, disabled: isLoggingIn }, isLoggingIn ? 'Logging in...' : 'Log in'),
                children));
        })));
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=LoginForm.js.map