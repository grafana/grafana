import { __awaiter, __generator } from "tslib";
import { config } from '@grafana/runtime';
import { initLoadOrgs, initLoadSessions, initLoadTeams, orgsLoaded, sessionsLoaded, setUpdating, teamsLoaded, userLoaded, userSessionRevoked, } from './reducers';
import { api } from '../api';
export function changePassword(payload) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dispatch(setUpdating({ updating: true }));
                        return [4 /*yield*/, api.changePassword(payload)];
                    case 1:
                        _a.sent();
                        dispatch(setUpdating({ updating: false }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
export function initUserProfilePage() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dispatch(loadUser())];
                    case 1:
                        _a.sent();
                        dispatch(loadTeams());
                        dispatch(loadOrgs());
                        dispatch(loadSessions());
                        return [2 /*return*/];
                }
            });
        });
    };
}
export function loadUser() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            var user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, api.loadUser()];
                    case 1:
                        user = _a.sent();
                        dispatch(userLoaded({ user: user }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
function loadTeams() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            var teams;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dispatch(initLoadTeams());
                        return [4 /*yield*/, api.loadTeams()];
                    case 1:
                        teams = _a.sent();
                        dispatch(teamsLoaded({ teams: teams }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
function loadOrgs() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            var orgs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dispatch(initLoadOrgs());
                        return [4 /*yield*/, api.loadOrgs()];
                    case 1:
                        orgs = _a.sent();
                        dispatch(orgsLoaded({ orgs: orgs }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
function loadSessions() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            var sessions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dispatch(initLoadSessions());
                        return [4 /*yield*/, api.loadSessions()];
                    case 1:
                        sessions = _a.sent();
                        dispatch(sessionsLoaded({ sessions: sessions }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
export function revokeUserSession(tokenId) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dispatch(setUpdating({ updating: true }));
                        return [4 /*yield*/, api.revokeUserSession(tokenId)];
                    case 1:
                        _a.sent();
                        dispatch(userSessionRevoked({ tokenId: tokenId }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
export function changeUserOrg(org) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dispatch(setUpdating({ updating: true }));
                        return [4 /*yield*/, api.setUserOrg(org)];
                    case 1:
                        _a.sent();
                        window.location.href = config.appSubUrl + '/profile';
                        return [2 /*return*/];
                }
            });
        });
    };
}
export function updateUserProfile(payload) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dispatch(setUpdating({ updating: true }));
                        return [4 /*yield*/, api.updateUserProfile(payload)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, dispatch(loadUser())];
                    case 2:
                        _a.sent();
                        dispatch(setUpdating({ updating: false }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
//# sourceMappingURL=actions.js.map