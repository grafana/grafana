import { __assign, __awaiter, __generator, __read } from "tslib";
import React, { useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, Form, Input } from '@grafana/ui';
import { useAsync } from 'react-use';
import Page from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { getConfig } from 'app/core/config';
var navModel = {
    main: {
        icon: 'grafana',
        text: 'Invite',
        subTitle: 'Register your Grafana account',
        breadcrumbs: [{ title: 'Login', url: 'login' }],
    },
    node: {
        text: '',
    },
};
export var SignupInvitedPage = function (_a) {
    var match = _a.match;
    var code = match.params.code;
    var _b = __read(useState(), 2), initFormModel = _b[0], setInitFormModel = _b[1];
    var _c = __read(useState(), 2), greeting = _c[0], setGreeting = _c[1];
    var _d = __read(useState(), 2), invitedBy = _d[0], setInvitedBy = _d[1];
    useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        var invite;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/user/invite/" + code)];
                case 1:
                    invite = _a.sent();
                    setInitFormModel({
                        email: invite.email,
                        name: invite.name,
                        username: invite.email,
                    });
                    setGreeting(invite.name || invite.email || invite.username);
                    setInvitedBy(invite.invitedBy);
                    return [2 /*return*/];
            }
        });
    }); }, [code]);
    var onSubmit = function (formData) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/user/invite/complete', __assign(__assign({}, formData), { inviteCode: code }))];
                case 1:
                    _a.sent();
                    window.location.href = getConfig().appSubUrl + '/';
                    return [2 /*return*/];
            }
        });
    }); };
    if (!initFormModel) {
        return null;
    }
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("h3", { className: "page-sub-heading" },
                "Hello ",
                greeting || 'there',
                "."),
            React.createElement("div", { className: "modal-tagline p-b-2" },
                React.createElement("em", null, invitedBy || 'Someone'),
                " has invited you to join Grafana and the organization",
                ' ',
                React.createElement("span", { className: "highlight-word" }, contextSrv.user.orgName),
                React.createElement("br", null),
                "Please complete the following and choose a password to accept your invitation and continue:"),
            React.createElement(Form, { defaultValues: initFormModel, onSubmit: onSubmit }, function (_a) {
                var register = _a.register, errors = _a.errors;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { invalid: !!errors.email, error: errors.email && errors.email.message, label: "Email" },
                        React.createElement(Input, __assign({ placeholder: "email@example.com" }, register('email', {
                            required: 'Email is required',
                            pattern: {
                                value: /^\S+@\S+$/,
                                message: 'Email is invalid',
                            },
                        })))),
                    React.createElement(Field, { invalid: !!errors.name, error: errors.name && errors.name.message, label: "Name" },
                        React.createElement(Input, __assign({ placeholder: "Name (optional)" }, register('name')))),
                    React.createElement(Field, { invalid: !!errors.username, error: errors.username && errors.username.message, label: "Username" },
                        React.createElement(Input, __assign({}, register('username', { required: 'Username is required' }), { placeholder: "Username" }))),
                    React.createElement(Field, { invalid: !!errors.password, error: errors.password && errors.password.message, label: "Password" },
                        React.createElement(Input, __assign({}, register('password', { required: 'Password is required' }), { type: "password", placeholder: "Password" }))),
                    React.createElement(Button, { type: "submit" }, "Sign up")));
            }))));
};
export default SignupInvitedPage;
//# sourceMappingURL=SignupInvited.js.map