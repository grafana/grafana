import { __awaiter } from "tslib";
import { config } from '@grafana/runtime';
import { api } from '../api';
import { initLoadOrgs, initLoadSessions, initLoadTeams, orgsLoaded, sessionsLoaded, setUpdating, teamsLoaded, userLoaded, userSessionRevoked, } from './reducers';
export function changePassword(payload) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            dispatch(setUpdating({ updating: true }));
            yield api.changePassword(payload);
            dispatch(setUpdating({ updating: false }));
        });
    };
}
export function initUserProfilePage() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            yield dispatch(loadUser());
            dispatch(loadTeams());
            dispatch(loadOrgs());
            dispatch(loadSessions());
        });
    };
}
export function loadUser() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield api.loadUser();
            dispatch(userLoaded({ user }));
        });
    };
}
function loadTeams() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            dispatch(initLoadTeams());
            const teams = yield api.loadTeams();
            dispatch(teamsLoaded({ teams }));
        });
    };
}
function loadOrgs() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            dispatch(initLoadOrgs());
            const orgs = yield api.loadOrgs();
            dispatch(orgsLoaded({ orgs }));
        });
    };
}
function loadSessions() {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            dispatch(initLoadSessions());
            const sessions = yield api.loadSessions();
            dispatch(sessionsLoaded({ sessions }));
        });
    };
}
export function revokeUserSession(tokenId) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            dispatch(setUpdating({ updating: true }));
            yield api.revokeUserSession(tokenId);
            dispatch(userSessionRevoked({ tokenId }));
        });
    };
}
export function changeUserOrg(org) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            dispatch(setUpdating({ updating: true }));
            yield api.setUserOrg(org);
            window.location.href = config.appSubUrl + '/profile';
        });
    };
}
export function updateUserProfile(payload) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            dispatch(setUpdating({ updating: true }));
            yield api.updateUserProfile(payload);
            yield dispatch(loadUser());
            dispatch(setUpdating({ updating: false }));
        });
    };
}
//# sourceMappingURL=actions.js.map