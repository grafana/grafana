import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
function changePassword(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield getBackendSrv().put('/api/user/password', payload);
        }
        catch (err) {
            console.error(err);
        }
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
    return __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post('/api/user/revoke-auth-token', {
            authTokenId: tokenId,
        });
    });
}
function setUserOrg(org) {
    return __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post('/api/user/using/' + org.orgId, {});
    });
}
function updateUserProfile(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield getBackendSrv().put('/api/user', payload);
        }
        catch (err) {
            console.error(err);
        }
    });
}
export const api = {
    changePassword,
    revokeUserSession,
    loadUser,
    loadSessions,
    loadOrgs,
    loadTeams,
    setUserOrg,
    updateUserProfile,
};
//# sourceMappingURL=api.js.map