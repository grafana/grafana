import { __awaiter } from "tslib";
import React, { useState, useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { Form, Field, Input, Button, Legend, Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { AccessControlAction } from 'app/types';
import { OrgUsersTable } from './Users/OrgUsersTable';
const perPage = 30;
const getOrg = (orgId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield getBackendSrv().get(`/api/orgs/${orgId}`);
});
const getOrgUsers = (orgId, page) => __awaiter(void 0, void 0, void 0, function* () {
    if (contextSrv.hasPermission(AccessControlAction.OrgUsersRead)) {
        return getBackendSrv().get(`/api/orgs/${orgId}/users/search`, accessControlQueryParam({ perpage: perPage, page }));
    }
    return { orgUsers: [] };
});
const updateOrgUserRole = (orgUser, orgId) => {
    return getBackendSrv().patch(`/api/orgs/${orgId}/users/${orgUser.userId}`, orgUser);
};
const removeOrgUser = (orgUser, orgId) => {
    return getBackendSrv().delete(`/api/orgs/${orgId}/users/${orgUser.userId}`);
};
const AdminEditOrgPage = ({ match }) => {
    var _a, _b;
    const orgId = parseInt(match.params.id, 10);
    const canWriteOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);
    const canReadUsers = contextSrv.hasPermission(AccessControlAction.OrgUsersRead);
    const [users, setUsers] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [orgState, fetchOrg] = useAsyncFn(() => getOrg(orgId), []);
    const [, fetchOrgUsers] = useAsyncFn((page) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield getOrgUsers(orgId, page);
        const totalPages = (result === null || result === void 0 ? void 0 : result.perPage) !== 0 ? Math.ceil(result.totalCount / result.perPage) : 0;
        setTotalPages(totalPages);
        setUsers(result.orgUsers);
        return result.orgUsers;
    }), []);
    useEffect(() => {
        fetchOrg();
        fetchOrgUsers(page);
    }, [fetchOrg, fetchOrgUsers, page]);
    const updateOrgName = (name) => __awaiter(void 0, void 0, void 0, function* () {
        return yield getBackendSrv().put(`/api/orgs/${orgId}`, Object.assign(Object.assign({}, orgState.value), { name }));
    });
    const renderMissingPermissionMessage = () => (React.createElement(Alert, { severity: "info", title: "Access denied" }, "You do not have permission to see users in this organization. To update this organization, contact your server administrator."));
    const onPageChange = (toPage) => {
        setPage(toPage);
    };
    const onRemoveUser = (orgUser) => __awaiter(void 0, void 0, void 0, function* () {
        yield removeOrgUser(orgUser, orgId);
        fetchOrgUsers(page);
    });
    const onRoleChange = (role, orgUser) => __awaiter(void 0, void 0, void 0, function* () {
        yield updateOrgUserRole(Object.assign(Object.assign({}, orgUser), { role }), orgId);
        fetchOrgUsers(page);
    });
    const pageNav = {
        text: (_b = (_a = orgState === null || orgState === void 0 ? void 0 : orgState.value) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '',
        icon: 'shield',
        subTitle: 'Manage settings and user roles for an organization.',
    };
    return (React.createElement(Page, { navId: "global-orgs", pageNav: pageNav, subTitle: "Manage settings for this specific org." },
        React.createElement(Page.Contents, null,
            React.createElement(React.Fragment, null,
                React.createElement(Legend, null, "Edit organization"),
                orgState.value && (React.createElement(Form, { defaultValues: { orgName: orgState.value.name }, onSubmit: (values) => updateOrgName(values.orgName) }, ({ register, errors }) => (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: "Name", invalid: !!errors.orgName, error: "Name is required", disabled: !canWriteOrg },
                        React.createElement(Input, Object.assign({}, register('orgName', { required: true }), { id: "org-name-input" }))),
                    React.createElement(Button, { type: "submit", disabled: !canWriteOrg }, "Update"))))),
                React.createElement("div", { style: { marginTop: '20px' } },
                    React.createElement(Legend, null, "Organization users"),
                    !canReadUsers && renderMissingPermissionMessage(),
                    canReadUsers && !!users.length && (React.createElement(OrgUsersTable, { users: users, orgId: orgId, onRoleChange: onRoleChange, onRemoveUser: onRemoveUser, changePage: onPageChange, page: page, totalPages: totalPages })))))));
};
export default AdminEditOrgPage;
//# sourceMappingURL=AdminEditOrgPage.js.map