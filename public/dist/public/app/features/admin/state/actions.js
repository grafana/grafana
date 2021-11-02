import { __awaiter, __generator } from "tslib";
import config from 'app/core/config';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { AccessControlAction } from 'app/types';
import { userAdminPageLoadedAction, userProfileLoadedAction, userOrgsLoadedAction, userSessionsLoadedAction, userAdminPageFailedAction, ldapConnectionInfoLoadedAction, ldapSyncStatusLoadedAction, userMappingInfoLoadedAction, userMappingInfoFailedAction, clearUserMappingInfoAction, clearUserErrorAction, ldapFailedAction, usersFetched, queryChanged, pageChanged, filterChanged, usersFetchBegin, usersFetchEnd, } from './reducers';
import { debounce } from 'lodash';
import { contextSrv } from 'app/core/core';
// UserAdminPage
export function loadAdminUserPage(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var error_1, userError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    dispatch(userAdminPageLoadedAction(false));
                    return [4 /*yield*/, dispatch(loadUserProfile(userId))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, dispatch(loadUserOrgs(userId))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, dispatch(loadUserSessions(userId))];
                case 3:
                    _a.sent();
                    if (!(config.ldapEnabled && config.licenseInfo.hasLicense)) return [3 /*break*/, 5];
                    return [4 /*yield*/, dispatch(loadLdapSyncStatus())];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    dispatch(userAdminPageLoadedAction(true));
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    console.error(error_1);
                    userError = {
                        title: error_1.data.message,
                        body: error_1.data.error,
                    };
                    dispatch(userAdminPageFailedAction(userError));
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); };
}
export function loadUserProfile(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/users/" + userId)];
                case 1:
                    user = _a.sent();
                    dispatch(userProfileLoadedAction(user));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateUser(user) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().put("/api/users/" + user.id, user)];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(user.id));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function setUserPassword(userId, password) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var payload;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    payload = { password: password };
                    return [4 /*yield*/, getBackendSrv().put("/api/admin/users/" + userId + "/password", payload)];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function disableUser(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post("/api/admin/users/" + userId + "/disable")];
                case 1:
                    _a.sent();
                    locationService.push('/admin/users');
                    return [2 /*return*/];
            }
        });
    }); };
}
export function enableUser(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post("/api/admin/users/" + userId + "/enable")];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function deleteUser(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().delete("/api/admin/users/" + userId)];
                case 1:
                    _a.sent();
                    locationService.push('/admin/users');
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateUserPermissions(userId, isGrafanaAdmin) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var payload;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    payload = { isGrafanaAdmin: isGrafanaAdmin };
                    return [4 /*yield*/, getBackendSrv().put("/api/admin/users/" + userId + "/permissions", payload)];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadUserOrgs(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var orgs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/users/" + userId + "/orgs")];
                case 1:
                    orgs = _a.sent();
                    dispatch(userOrgsLoadedAction(orgs));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function addOrgUser(user, orgId, role) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var payload;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    payload = {
                        loginOrEmail: user.login,
                        role: role,
                    };
                    return [4 /*yield*/, getBackendSrv().post("/api/orgs/" + orgId + "/users/", payload)];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(user.id));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateOrgUserRole(userId, orgId, role) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var payload;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    payload = { role: role };
                    return [4 /*yield*/, getBackendSrv().patch("/api/orgs/" + orgId + "/users/" + userId, payload)];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function deleteOrgUser(userId, orgId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().delete("/api/orgs/" + orgId + "/users/" + userId)];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadUserSessions(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var tokens, sessions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!contextSrv.hasPermission(AccessControlAction.UsersAuthTokenList)) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getBackendSrv().get("/api/admin/users/" + userId + "/auth-tokens")];
                case 1:
                    tokens = _a.sent();
                    tokens.reverse();
                    sessions = tokens.map(function (session) {
                        return {
                            id: session.id,
                            isActive: session.isActive,
                            seenAt: dateTimeFormatTimeAgo(session.seenAt),
                            createdAt: dateTimeFormat(session.createdAt, { format: 'MMMM DD, YYYY' }),
                            clientIp: session.clientIp,
                            browser: session.browser,
                            browserVersion: session.browserVersion,
                            os: session.os,
                            osVersion: session.osVersion,
                            device: session.device,
                        };
                    });
                    dispatch(userSessionsLoadedAction(sessions));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function revokeSession(tokenId, userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var payload;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    payload = { authTokenId: tokenId };
                    return [4 /*yield*/, getBackendSrv().post("/api/admin/users/" + userId + "/revoke-auth-token", payload)];
                case 1:
                    _a.sent();
                    dispatch(loadUserSessions(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function revokeAllSessions(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post("/api/admin/users/" + userId + "/logout")];
                case 1:
                    _a.sent();
                    dispatch(loadUserSessions(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
// LDAP user actions
export function loadLdapSyncStatus() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var canReadLDAPStatus, syncStatus;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    canReadLDAPStatus = contextSrv.hasPermission(AccessControlAction.LDAPStatusRead);
                    if (!(config.licenseInfo.hasLicense && canReadLDAPStatus)) return [3 /*break*/, 2];
                    return [4 /*yield*/, getBackendSrv().get("/api/admin/ldap-sync-status")];
                case 1:
                    syncStatus = _a.sent();
                    dispatch(ldapSyncStatusLoadedAction(syncStatus));
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
}
export function syncLdapUser(userId) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post("/api/admin/ldap/sync/" + userId)];
                case 1:
                    _a.sent();
                    dispatch(loadAdminUserPage(userId));
                    return [2 /*return*/];
            }
        });
    }); };
}
// LDAP debug page
export function loadLdapState() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var connectionInfo, error_2, ldapError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!contextSrv.hasPermission(AccessControlAction.LDAPStatusRead)) {
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, getBackendSrv().get("/api/admin/ldap/status")];
                case 2:
                    connectionInfo = _a.sent();
                    dispatch(ldapConnectionInfoLoadedAction(connectionInfo));
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    error_2.isHandled = true;
                    ldapError = {
                        title: error_2.data.message,
                        body: error_2.data.error,
                    };
                    dispatch(ldapFailedAction(ldapError));
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
}
export function loadUserMapping(username) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var response, name_1, surname, email, login, isGrafanaAdmin, isDisabled, roles, teams, userInfo, error_3, userError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().get("/api/admin/ldap/" + encodeURIComponent(username))];
                case 1:
                    response = _a.sent();
                    name_1 = response.name, surname = response.surname, email = response.email, login = response.login, isGrafanaAdmin = response.isGrafanaAdmin, isDisabled = response.isDisabled, roles = response.roles, teams = response.teams;
                    userInfo = {
                        info: { name: name_1, surname: surname, email: email, login: login },
                        permissions: { isGrafanaAdmin: isGrafanaAdmin, isDisabled: isDisabled },
                        roles: roles,
                        teams: teams,
                    };
                    dispatch(userMappingInfoLoadedAction(userInfo));
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    error_3.isHandled = true;
                    userError = {
                        title: error_3.data.message,
                        body: error_3.data.error,
                    };
                    dispatch(clearUserMappingInfoAction());
                    dispatch(userMappingInfoFailedAction(userError));
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
}
export function clearUserError() {
    return function (dispatch) {
        dispatch(clearUserErrorAction());
    };
}
export function clearUserMappingInfo() {
    return function (dispatch) {
        dispatch(clearUserErrorAction());
        dispatch(clearUserMappingInfoAction());
    };
}
// UserListAdminPage
var getFilters = function (filters) {
    return filters
        .map(function (filter) {
        if (Array.isArray(filter.value)) {
            return filter.value.map(function (v) { return filter.name + "=" + v.value; }).join('&');
        }
        return filter.name + "=" + filter.value;
    })
        .join('&');
};
export function fetchUsers() {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var _a, perPage, page, query, filters, result, error_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = getState().userListAdmin, perPage = _a.perPage, page = _a.page, query = _a.query, filters = _a.filters;
                    return [4 /*yield*/, getBackendSrv().get("/api/users/search?perpage=" + perPage + "&page=" + page + "&query=" + query + "&" + getFilters(filters))];
                case 1:
                    result = _b.sent();
                    dispatch(usersFetched(result));
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _b.sent();
                    usersFetchEnd();
                    console.error(error_4);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
}
var fetchUsersWithDebounce = debounce(function (dispatch) { return dispatch(fetchUsers()); }, 500);
export function changeQuery(query) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            dispatch(usersFetchBegin());
            dispatch(queryChanged(query));
            fetchUsersWithDebounce(dispatch);
            return [2 /*return*/];
        });
    }); };
}
export function changeFilter(filter) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            dispatch(usersFetchBegin());
            dispatch(filterChanged(filter));
            fetchUsersWithDebounce(dispatch);
            return [2 /*return*/];
        });
    }); };
}
export function changePage(page) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            dispatch(usersFetchBegin());
            dispatch(pageChanged(page));
            dispatch(fetchUsers());
            return [2 /*return*/];
        });
    }); };
}
//# sourceMappingURL=actions.js.map