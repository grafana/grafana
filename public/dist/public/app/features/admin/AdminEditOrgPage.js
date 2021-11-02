import { __assign, __awaiter, __generator, __makeTemplateObject, __read } from "tslib";
import React, { useState, useEffect } from 'react';
import Page from 'app/core/components/Page/Page';
import { useSelector } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import UsersTable from '../users/UsersTable';
import { useAsyncFn } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, Legend } from '@grafana/ui';
import { css } from '@emotion/css';
var getOrg = function (orgId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().get('/api/orgs/' + orgId)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var getOrgUsers = function (orgId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().get('/api/orgs/' + orgId + '/users')];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var updateOrgUserRole = function (orgUser, orgId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().patch('/api/orgs/' + orgId + '/users/' + orgUser.userId, orgUser)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var removeOrgUser = function (orgUser, orgId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getBackendSrv().delete('/api/orgs/' + orgId + '/users/' + orgUser.userId)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
export var AdminEditOrgPage = function (_a) {
    var match = _a.match;
    var navIndex = useSelector(function (state) { return state.navIndex; });
    var navModel = getNavModel(navIndex, 'global-orgs');
    var orgId = parseInt(match.params.id, 10);
    var _b = __read(useState([]), 2), users = _b[0], setUsers = _b[1];
    var _c = __read(useAsyncFn(function () { return getOrg(orgId); }, []), 2), orgState = _c[0], fetchOrg = _c[1];
    var _d = __read(useAsyncFn(function () { return getOrgUsers(orgId); }, []), 2), fetchOrgUsers = _d[1];
    useEffect(function () {
        fetchOrg();
        fetchOrgUsers().then(function (res) { return setUsers(res); });
    }, [fetchOrg, fetchOrgUsers]);
    var updateOrgName = function (name) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().put('/api/orgs/' + orgId, __assign(__assign({}, orgState.value), { name: name }))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(React.Fragment, null,
                React.createElement(Legend, null, "Edit organization"),
                orgState.value && (React.createElement(Form, { defaultValues: { orgName: orgState.value.name }, onSubmit: function (values) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, updateOrgName(values.orgName)];
                            case 1: return [2 /*return*/, _a.sent()];
                        }
                    }); }); } }, function (_a) {
                    var register = _a.register, errors = _a.errors;
                    return (React.createElement(React.Fragment, null,
                        React.createElement(Field, { label: "Name", invalid: !!errors.orgName, error: "Name is required" },
                            React.createElement(Input, __assign({}, register('orgName', { required: true }), { id: "org-name-input" }))),
                        React.createElement(Button, null, "Update")));
                })),
                React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              margin-top: 20px;\n            "], ["\n              margin-top: 20px;\n            "]))) },
                    React.createElement(Legend, null, "Organization users"),
                    !!users.length && (React.createElement(UsersTable, { users: users, onRoleChange: function (role, orgUser) {
                            updateOrgUserRole(__assign(__assign({}, orgUser), { role: role }), orgId);
                            setUsers(users.map(function (user) {
                                if (orgUser.userId === user.userId) {
                                    return __assign(__assign({}, orgUser), { role: role });
                                }
                                return user;
                            }));
                            fetchOrgUsers();
                        }, onRemoveUser: function (orgUser) {
                            removeOrgUser(orgUser, orgId);
                            setUsers(users.filter(function (user) { return orgUser.userId !== user.userId; }));
                            fetchOrgUsers();
                        } })))))));
};
export default AdminEditOrgPage;
var templateObject_1;
//# sourceMappingURL=AdminEditOrgPage.js.map