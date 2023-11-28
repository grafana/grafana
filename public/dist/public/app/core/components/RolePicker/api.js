import { __awaiter } from "tslib";
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { addDisplayNameForFixedRole } from './utils';
export const fetchRoleOptions = (orgId, query) => __awaiter(void 0, void 0, void 0, function* () {
    let rolesUrl = '/api/access-control/roles?delegatable=true';
    if (orgId) {
        rolesUrl += `&targetOrgId=${orgId}`;
    }
    const roles = yield getBackendSrv().get(rolesUrl);
    if (!roles || !roles.length) {
        return [];
    }
    return roles.map(addDisplayNameForFixedRole);
});
export const fetchUserRoles = (userId, orgId) => __awaiter(void 0, void 0, void 0, function* () {
    let userRolesUrl = `/api/access-control/users/${userId}/roles`;
    if (orgId) {
        userRolesUrl += `?targetOrgId=${orgId}`;
    }
    try {
        const roles = yield getBackendSrv().get(userRolesUrl);
        if (!roles || !roles.length) {
            return [];
        }
        return roles.map(addDisplayNameForFixedRole);
    }
    catch (error) {
        if (isFetchError(error)) {
            error.isHandled = true;
        }
        return [];
    }
});
export const updateUserRoles = (roles, userId, orgId) => {
    let userRolesUrl = `/api/access-control/users/${userId}/roles`;
    if (orgId) {
        userRolesUrl += `?targetOrgId=${orgId}`;
    }
    const roleUids = roles.flatMap((x) => x.uid);
    return getBackendSrv().put(userRolesUrl, {
        orgId,
        roleUids,
    });
};
export const fetchTeamRoles = (teamId, orgId) => __awaiter(void 0, void 0, void 0, function* () {
    let teamRolesUrl = `/api/access-control/teams/${teamId}/roles`;
    if (orgId) {
        teamRolesUrl += `?targetOrgId=${orgId}`;
    }
    try {
        const roles = yield getBackendSrv().get(teamRolesUrl);
        if (!roles || !roles.length) {
            return [];
        }
        return roles.map(addDisplayNameForFixedRole);
    }
    catch (error) {
        if (isFetchError(error)) {
            error.isHandled = true;
        }
        return [];
    }
});
export const updateTeamRoles = (roles, teamId, orgId) => {
    let teamRolesUrl = `/api/access-control/teams/${teamId}/roles`;
    if (orgId) {
        teamRolesUrl += `?targetOrgId=${orgId}`;
    }
    const roleUids = roles.flatMap((x) => x.uid);
    return getBackendSrv().put(teamRolesUrl, {
        orgId,
        roleUids,
    });
};
//# sourceMappingURL=api.js.map