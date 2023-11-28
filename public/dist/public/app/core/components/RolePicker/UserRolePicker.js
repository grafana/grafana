import { __awaiter } from "tslib";
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { RolePicker } from './RolePicker';
import { fetchUserRoles, updateUserRoles } from './api';
export const UserRolePicker = ({ basicRole, userId, orgId, onBasicRoleChange, roleOptions, disabled, basicRoleDisabled, basicRoleDisabledMessage, apply = false, onApplyRoles, pendingRoles, maxWidth, }) => {
    const [{ loading, value: appliedRoles = [] }, getUserRoles] = useAsyncFn(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (apply && Boolean(pendingRoles === null || pendingRoles === void 0 ? void 0 : pendingRoles.length)) {
                return pendingRoles;
            }
            if (contextSrv.hasPermission(AccessControlAction.ActionUserRolesList)) {
                return yield fetchUserRoles(userId, orgId);
            }
        }
        catch (e) {
            // TODO handle error
            console.error('Error loading options');
        }
        return [];
    }), [orgId, userId, pendingRoles]);
    useEffect(() => {
        // only load roles when there is an Org selected
        if (orgId) {
            getUserRoles();
        }
    }, [orgId, getUserRoles, pendingRoles]);
    const onRolesChange = (roles) => __awaiter(void 0, void 0, void 0, function* () {
        if (!apply) {
            yield updateUserRoles(roles, userId, orgId);
            yield getUserRoles();
        }
        else if (onApplyRoles) {
            onApplyRoles(roles, userId, orgId);
        }
    });
    const canUpdateRoles = contextSrv.hasPermission(AccessControlAction.ActionUserRolesAdd) &&
        contextSrv.hasPermission(AccessControlAction.ActionUserRolesRemove);
    return (React.createElement(RolePicker, { appliedRoles: appliedRoles, basicRole: basicRole, onRolesChange: onRolesChange, onBasicRoleChange: onBasicRoleChange, roleOptions: roleOptions, isLoading: loading, disabled: disabled, basicRoleDisabled: basicRoleDisabled, basicRoleDisabledMessage: basicRoleDisabledMessage, showBasicRole: true, apply: apply, canUpdateRoles: canUpdateRoles, maxWidth: maxWidth }));
};
//# sourceMappingURL=UserRolePicker.js.map