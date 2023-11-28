import { __awaiter } from "tslib";
import { debounce } from 'lodash';
import { dateTimeFormatTimeAgo } from '@grafana/data';
import { featureEnabled, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import config from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { AccessControlAction } from 'app/types';
import { userAdminPageLoadedAction, userProfileLoadedAction, userOrgsLoadedAction, userSessionsLoadedAction, userAdminPageFailedAction, ldapConnectionInfoLoadedAction, ldapSyncStatusLoadedAction, userMappingInfoLoadedAction, userMappingInfoFailedAction, clearUserMappingInfoAction, clearUserErrorAction, ldapFailedAction, usersFetched, queryChanged, pageChanged, filterChanged, usersFetchBegin, usersFetchEnd, sortChanged, } from './reducers';
// UserAdminPage
export function loadAdminUserPage(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            dispatch(userAdminPageLoadedAction(false));
            yield dispatch(loadUserProfile(userId));
            yield dispatch(loadUserOrgs(userId));
            yield dispatch(loadUserSessions(userId));
            if (config.ldapEnabled && featureEnabled('ldapsync')) {
                yield dispatch(loadLdapSyncStatus());
            }
            dispatch(userAdminPageLoadedAction(true));
        }
        catch (error) {
            console.error(error);
            if (isFetchError(error)) {
                const userError = {
                    title: error.data.message,
                    body: error.data.error,
                };
                dispatch(userAdminPageFailedAction(userError));
            }
        }
    });
}
export function loadUserProfile(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const user = yield getBackendSrv().get(`/api/users/${userId}`, accessControlQueryParam());
        dispatch(userProfileLoadedAction(user));
    });
}
export function updateUser(user) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().put(`/api/users/${user.id}`, user);
        dispatch(loadAdminUserPage(user.id));
    });
}
export function setUserPassword(userId, password) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const payload = { password };
        yield getBackendSrv().put(`/api/admin/users/${userId}/password`, payload);
        dispatch(loadAdminUserPage(userId));
    });
}
export function disableUser(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post(`/api/admin/users/${userId}/disable`);
        locationService.push('/admin/users');
    });
}
export function enableUser(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post(`/api/admin/users/${userId}/enable`);
        dispatch(loadAdminUserPage(userId));
    });
}
export function deleteUser(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/admin/users/${userId}`);
        locationService.push('/admin/users');
    });
}
export function updateUserPermissions(userId, isGrafanaAdmin) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const payload = { isGrafanaAdmin };
        yield getBackendSrv().put(`/api/admin/users/${userId}/permissions`, payload);
        dispatch(loadAdminUserPage(userId));
    });
}
export function loadUserOrgs(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const orgs = yield getBackendSrv().get(`/api/users/${userId}/orgs`);
        dispatch(userOrgsLoadedAction(orgs));
    });
}
export function addOrgUser(user, orgId, role) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const payload = {
            loginOrEmail: user.login,
            role: role,
        };
        yield getBackendSrv().post(`/api/orgs/${orgId}/users/`, payload);
        dispatch(loadAdminUserPage(user.id));
    });
}
export function updateOrgUserRole(userId, orgId, role) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const payload = { role };
        yield getBackendSrv().patch(`/api/orgs/${orgId}/users/${userId}`, payload);
        dispatch(loadAdminUserPage(userId));
    });
}
export function deleteOrgUser(userId, orgId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/orgs/${orgId}/users/${userId}`);
        dispatch(loadAdminUserPage(userId));
    });
}
export function loadUserSessions(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        if (!contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList)) {
            return;
        }
        const tokens = yield getBackendSrv().get(`/api/admin/users/${userId}/auth-tokens`);
        tokens.reverse();
        const sessions = tokens.map((session) => {
            return {
                id: session.id,
                isActive: session.isActive,
                seenAt: dateTimeFormatTimeAgo(session.seenAt),
                createdAt: session.createdAt,
                clientIp: session.clientIp,
                browser: session.browser,
                browserVersion: session.browserVersion,
                os: session.os,
                osVersion: session.osVersion,
                device: session.device,
            };
        });
        dispatch(userSessionsLoadedAction(sessions));
    });
}
export function revokeSession(tokenId, userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const payload = { authTokenId: tokenId };
        yield getBackendSrv().post(`/api/admin/users/${userId}/revoke-auth-token`, payload);
        dispatch(loadUserSessions(userId));
    });
}
export function revokeAllSessions(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post(`/api/admin/users/${userId}/logout`);
        dispatch(loadUserSessions(userId));
    });
}
// LDAP user actions
export function loadLdapSyncStatus() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        // Available only in enterprise
        const canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
        if (featureEnabled('ldapsync') && canReadLDAPStatus) {
            const syncStatus = yield getBackendSrv().get(`/api/admin/ldap-sync-status`);
            dispatch(ldapSyncStatusLoadedAction(syncStatus));
        }
    });
}
export function syncLdapUser(userId) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post(`/api/admin/ldap/sync/${userId}`);
        dispatch(loadAdminUserPage(userId));
    });
}
// LDAP debug page
export function loadLdapState() {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        if (!contextSrv.hasPermission(AccessControlAction.LDAPStatusRead)) {
            return;
        }
        try {
            const connectionInfo = yield getBackendSrv().get(`/api/admin/ldap/status`);
            dispatch(ldapConnectionInfoLoadedAction(connectionInfo));
        }
        catch (error) {
            if (isFetchError(error)) {
                error.isHandled = true;
                const ldapError = {
                    title: error.data.message,
                    body: error.data.error,
                };
                dispatch(ldapFailedAction(ldapError));
            }
        }
    });
}
export function loadUserMapping(username) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield getBackendSrv().get(`/api/admin/ldap/${encodeURIComponent(username)}`);
            const { name, surname, email, login, isGrafanaAdmin, isDisabled, roles, teams } = response;
            const userInfo = {
                info: { name, surname, email, login },
                permissions: { isGrafanaAdmin, isDisabled },
                roles,
                teams,
            };
            dispatch(userMappingInfoLoadedAction(userInfo));
        }
        catch (error) {
            if (isFetchError(error)) {
                error.isHandled = true;
                const userError = {
                    title: error.data.message,
                    body: error.data.error,
                };
                dispatch(clearUserMappingInfoAction());
                dispatch(userMappingInfoFailedAction(userError));
            }
        }
    });
}
export function clearUserError() {
    return (dispatch) => {
        dispatch(clearUserErrorAction());
    };
}
export function clearUserMappingInfo() {
    return (dispatch) => {
        dispatch(clearUserErrorAction());
        dispatch(clearUserMappingInfoAction());
    };
}
// UserListAdminPage
const getFilters = (filters) => {
    return filters
        .map((filter) => {
        if (Array.isArray(filter.value)) {
            return filter.value.map((v) => `${filter.name}=${v.value}`).join('&');
        }
        return `${filter.name}=${filter.value}`;
    })
        .join('&');
};
export function fetchUsers() {
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        try {
            const { perPage, page, query, filters, sort } = getState().userListAdmin;
            let url = `/api/users/search?perpage=${perPage}&page=${page}&query=${query}&${getFilters(filters)}`;
            if (sort) {
                url += `&sort=${sort}`;
            }
            const result = yield getBackendSrv().get(url);
            dispatch(usersFetched(result));
        }
        catch (error) {
            usersFetchEnd();
            console.error(error);
        }
    });
}
const fetchUsersWithDebounce = debounce((dispatch) => dispatch(fetchUsers()), 500);
export function changeQuery(query) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(usersFetchBegin());
        dispatch(queryChanged(query));
        fetchUsersWithDebounce(dispatch);
    });
}
export function changeFilter(filter) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(usersFetchBegin());
        dispatch(filterChanged(filter));
        fetchUsersWithDebounce(dispatch);
    });
}
export function changePage(page) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        dispatch(usersFetchBegin());
        dispatch(pageChanged(page));
        dispatch(fetchUsers());
    });
}
export function changeSort({ sortBy }) {
    const sort = sortBy.length ? `${sortBy[0].id}-${sortBy[0].desc ? 'desc' : 'asc'}` : undefined;
    return (dispatch, getState) => __awaiter(this, void 0, void 0, function* () {
        const currentSort = getState().userListAdmin.sort;
        if (currentSort !== sort) {
            dispatch(usersFetchBegin());
            dispatch(sortChanged(sort));
            dispatch(fetchUsers());
        }
    });
}
//# sourceMappingURL=actions.js.map