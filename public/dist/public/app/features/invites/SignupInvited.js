import { __awaiter } from "tslib";
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, Form, Input } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getConfig } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { w3cStandardEmailValidator } from '../admin/utils';
const navModel = {
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
export const SignupInvitedPage = ({ match }) => {
    const code = match.params.code;
    const [initFormModel, setInitFormModel] = useState();
    const [greeting, setGreeting] = useState();
    const [invitedBy, setInvitedBy] = useState();
    useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        const invite = yield getBackendSrv().get(`/api/user/invite/${code}`);
        setInitFormModel({
            email: invite.email,
            name: invite.name,
            username: invite.email,
        });
        setGreeting(invite.name || invite.email || invite.username);
        setInvitedBy(invite.invitedBy);
    }), [code]);
    const onSubmit = (formData) => __awaiter(void 0, void 0, void 0, function* () {
        yield getBackendSrv().post('/api/user/invite/complete', Object.assign(Object.assign({}, formData), { inviteCode: code }));
        window.location.href = getConfig().appSubUrl + '/';
    });
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
            React.createElement(Form, { defaultValues: initFormModel, onSubmit: onSubmit }, ({ register, errors }) => (React.createElement(React.Fragment, null,
                React.createElement(Field, { invalid: !!errors.email, error: errors.email && errors.email.message, label: "Email" },
                    React.createElement(Input, Object.assign({ placeholder: "email@example.com" }, register('email', {
                        required: 'Email is required',
                        pattern: {
                            value: w3cStandardEmailValidator,
                            message: 'Email is invalid',
                        },
                    })))),
                React.createElement(Field, { invalid: !!errors.name, error: errors.name && errors.name.message, label: "Name" },
                    React.createElement(Input, Object.assign({ placeholder: "Name (optional)" }, register('name')))),
                React.createElement(Field, { invalid: !!errors.username, error: errors.username && errors.username.message, label: "Username" },
                    React.createElement(Input, Object.assign({}, register('username', { required: 'Username is required' }), { placeholder: "Username" }))),
                React.createElement(Field, { invalid: !!errors.password, error: errors.password && errors.password.message, label: "Password" },
                    React.createElement(Input, Object.assign({}, register('password', { required: 'Password is required' }), { type: "password", placeholder: "Password" }))),
                React.createElement(Button, { type: "submit" }, "Sign up")))))));
};
export default SignupInvitedPage;
//# sourceMappingURL=SignupInvited.js.map