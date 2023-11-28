import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Form, Button, Input, Field, FieldSet } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { UserRolePicker } from 'app/core/components/RolePicker/UserRolePicker';
import { fetchRoleOptions, updateUserRoles } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, OrgRole } from 'app/types';
import { OrgRolePicker } from '../admin/OrgRolePicker';
const createServiceAccount = (sa) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getBackendSrv().post('/api/serviceaccounts/', sa);
    yield contextSrv.fetchUserPermissions();
    return result;
});
const updateServiceAccount = (id, sa) => __awaiter(void 0, void 0, void 0, function* () { return getBackendSrv().patch(`/api/serviceaccounts/${id}`, sa); });
export const ServiceAccountCreatePage = ({}) => {
    const [roleOptions, setRoleOptions] = useState([]);
    const [pendingRoles, setPendingRoles] = useState([]);
    const currentOrgId = contextSrv.user.orgId;
    const [serviceAccount, setServiceAccount] = useState({
        id: 0,
        orgId: contextSrv.user.orgId,
        role: OrgRole.None,
        tokens: 0,
        name: '',
        login: '',
        isDisabled: false,
        createdAt: '',
        teams: [],
    });
    useEffect(() => {
        function fetchOptions() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    if (contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
                        let options = yield fetchRoleOptions(currentOrgId);
                        setRoleOptions(options);
                    }
                }
                catch (e) {
                    console.error('Error loading options', e);
                }
            });
        }
        if (contextSrv.licensedAccessControlEnabled()) {
            fetchOptions();
        }
    }, [currentOrgId]);
    const onSubmit = useCallback((data) => __awaiter(void 0, void 0, void 0, function* () {
        data.role = serviceAccount.role;
        const response = yield createServiceAccount(data);
        try {
            const newAccount = {
                avatarUrl: response.avatarUrl,
                id: response.id,
                isDisabled: response.isDisabled,
                login: response.login,
                name: response.name,
                orgId: response.orgId,
                role: response.role,
                tokens: response.tokens,
            };
            yield updateServiceAccount(response.id, data);
            if (contextSrv.licensedAccessControlEnabled() &&
                contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
                contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove)) {
                yield updateUserRoles(pendingRoles, newAccount.id, newAccount.orgId);
            }
        }
        catch (e) {
            console.error(e);
        }
        locationService.push(`/org/serviceaccounts/${response.id}`);
    }), [serviceAccount.role, pendingRoles]);
    const onRoleChange = (role) => {
        setServiceAccount(Object.assign(Object.assign({}, serviceAccount), { role: role }));
    };
    const onPendingRolesUpdate = (roles, userId, orgId) => {
        // keep the new role assignments for user
        setPendingRoles(roles);
    };
    return (React.createElement(Page, { navId: "serviceaccounts", pageNav: { text: 'Create service account' } },
        React.createElement(Page.Contents, null,
            React.createElement(Form, { onSubmit: onSubmit, validateOn: "onSubmit" }, ({ register, errors }) => {
                return (React.createElement(React.Fragment, null,
                    React.createElement(FieldSet, null,
                        React.createElement(Field, { label: "Display name", required: true, invalid: !!errors.name, error: errors.name ? 'Display name is required' : undefined },
                            React.createElement(Input, Object.assign({ id: "display-name-input" }, register('name', { required: true }), { autoFocus: true }))),
                        React.createElement(Field, { label: "Role" }, contextSrv.licensedAccessControlEnabled() ? (React.createElement(UserRolePicker, { apply: true, userId: serviceAccount.id || 0, orgId: serviceAccount.orgId, basicRole: serviceAccount.role, onBasicRoleChange: onRoleChange, roleOptions: roleOptions, onApplyRoles: onPendingRolesUpdate, pendingRoles: pendingRoles, maxWidth: "100%" })) : (React.createElement(OrgRolePicker, { "aria-label": "Role", value: serviceAccount.role, onChange: onRoleChange })))),
                    React.createElement(Button, { type: "submit" }, "Create")));
            }))));
};
export default ServiceAccountCreatePage;
//# sourceMappingURL=ServiceAccountCreatePage.js.map