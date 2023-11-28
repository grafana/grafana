import { __awaiter } from "tslib";
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { RolePicker } from './RolePicker';
import { fetchTeamRoles, updateTeamRoles } from './api';
export const TeamRolePicker = ({ teamId, roleOptions, disabled, onApplyRoles, pendingRoles, apply = false, maxWidth, }) => {
    const [{ loading, value: appliedRoles = [] }, getTeamRoles] = useAsyncFn(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (apply && Boolean(pendingRoles === null || pendingRoles === void 0 ? void 0 : pendingRoles.length)) {
                return pendingRoles;
            }
            if (contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList)) {
                return yield fetchTeamRoles(teamId);
            }
        }
        catch (e) {
            console.error('Error loading options', e);
        }
        return [];
    }), [teamId, pendingRoles]);
    useEffect(() => {
        getTeamRoles();
    }, [teamId, getTeamRoles, pendingRoles]);
    const onRolesChange = (roles) => __awaiter(void 0, void 0, void 0, function* () {
        if (!apply) {
            yield updateTeamRoles(roles, teamId);
            yield getTeamRoles();
        }
        else if (onApplyRoles) {
            onApplyRoles(roles);
        }
    });
    const canUpdateRoles = contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesAdd) &&
        contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesRemove);
    return (React.createElement(RolePicker, { apply: apply, onRolesChange: onRolesChange, roleOptions: roleOptions, appliedRoles: appliedRoles, isLoading: loading, disabled: disabled, basicRoleDisabled: true, canUpdateRoles: canUpdateRoles, maxWidth: maxWidth }));
};
//# sourceMappingURL=TeamRolePicker.js.map