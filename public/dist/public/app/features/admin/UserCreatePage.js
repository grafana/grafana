import { __awaiter } from "tslib";
import React, { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Button, Input, Field } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
const createUser = (user) => __awaiter(void 0, void 0, void 0, function* () { return getBackendSrv().post('/api/admin/users', user); });
const pageNav = {
    icon: 'user',
    id: 'user-new',
    text: 'New user',
    subTitle: 'Create a new Grafana user.',
};
const UserCreatePage = () => {
    const history = useHistory();
    const onSubmit = useCallback((data) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = yield createUser(data);
        history.push(`/admin/users/edit/${id}`);
    }), [history]);
    return (React.createElement(Page, { navId: "global-users", pageNav: pageNav },
        React.createElement(Page.Contents, null,
            React.createElement(Form, { onSubmit: onSubmit, validateOn: "onBlur" }, ({ register, errors }) => {
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Name", required: true, invalid: !!errors.name, error: errors.name ? 'Name is required' : undefined },
                        React.createElement(Input, Object.assign({ id: "name-input" }, register('name', { required: true })))),
                    React.createElement(Field, { label: "Email" },
                        React.createElement(Input, Object.assign({ id: "email-input" }, register('email')))),
                    React.createElement(Field, { label: "Username" },
                        React.createElement(Input, Object.assign({ id: "username-input" }, register('login')))),
                    React.createElement(Field, { label: "Password", required: true, invalid: !!errors.password, error: errors.password ? 'Password is required and must contain at least 4 characters' : undefined },
                        React.createElement(Input, Object.assign({ id: "password-input" }, register('password', {
                            validate: (value) => value.trim() !== '' && value.length >= 4,
                        }), { type: "password" }))),
                    React.createElement(Button, { type: "submit" }, "Create user")));
            }))));
};
export default UserCreatePage;
//# sourceMappingURL=UserCreatePage.js.map