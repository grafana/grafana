import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
function changePassword(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().put('/api/user/password', payload)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    console.error(err_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function loadUser() {
    return getBackendSrv().get('/api/user');
}
function loadTeams() {
    return getBackendSrv().get('/api/user/teams');
}
function loadOrgs() {
    return getBackendSrv().get('/api/user/orgs');
}
function loadSessions() {
    return getBackendSrv().get('/api/user/auth-tokens');
}
function revokeUserSession(tokenId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/user/revoke-auth-token', {
                        authTokenId: tokenId,
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function setUserOrg(org) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/user/using/' + org.orgId, {})];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function updateUserProfile(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().put('/api/user', payload)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_2 = _a.sent();
                    console.error(err_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
export var api = {
    changePassword: changePassword,
    revokeUserSession: revokeUserSession,
    loadUser: loadUser,
    loadSessions: loadSessions,
    loadOrgs: loadOrgs,
    loadTeams: loadTeams,
    setUserOrg: setUserOrg,
    updateUserProfile: updateUserProfile,
};
//# sourceMappingURL=api.js.map