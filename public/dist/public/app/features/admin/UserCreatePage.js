import { __assign, __awaiter, __generator } from "tslib";
import React, { useCallback } from 'react';
import { connect } from 'react-redux';
import { Form, Button, Input, Field } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { getNavModel } from '../../core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { useHistory } from 'react-router-dom';
var createUser = function (user) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, getBackendSrv().post('/api/admin/users', user)];
}); }); };
var UserCreatePage = function (_a) {
    var navModel = _a.navModel;
    var history = useHistory();
    var onSubmit = useCallback(function (data) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createUser(data)];
                case 1:
                    _a.sent();
                    history.push('/admin/users');
                    return [2 /*return*/];
            }
        });
    }); }, [history]);
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement("h1", null, "Add new user"),
            React.createElement(Form, { onSubmit: onSubmit, validateOn: "onBlur" }, function (_a) {
                var register = _a.register, errors = _a.errors;
                return (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Name", required: true, invalid: !!errors.name, error: errors.name ? 'Name is required' : undefined },
                        React.createElement(Input, __assign({}, register('name', { required: true })))),
                    React.createElement(Field, { label: "Email" },
                        React.createElement(Input, __assign({}, register('email')))),
                    React.createElement(Field, { label: "Username" },
                        React.createElement(Input, __assign({}, register('login')))),
                    React.createElement(Field, { label: "Password", required: true, invalid: !!errors.password, error: errors.password ? 'Password is required and must contain at least 4 characters' : undefined },
                        React.createElement(Input, __assign({}, register('password', {
                            validate: function (value) { return value.trim() !== '' && value.length >= 4; },
                        }), { type: "password" }))),
                    React.createElement(Button, { type: "submit" }, "Create user")));
            }))));
};
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'global-users'),
}); };
export default connect(mapStateToProps)(UserCreatePage);
//# sourceMappingURL=UserCreatePage.js.map