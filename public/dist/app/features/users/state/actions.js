import * as tslib_1 from "tslib";
import { getBackendSrv } from '../../../core/services/backend_srv';
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["LoadUsers"] = "LOAD_USERS";
    ActionTypes["LoadInvitees"] = "LOAD_INVITEES";
    ActionTypes["SetUsersSearchQuery"] = "SET_USERS_SEARCH_QUERY";
})(ActionTypes || (ActionTypes = {}));
var usersLoaded = function (users) { return ({
    type: ActionTypes.LoadUsers,
    payload: users,
}); };
var inviteesLoaded = function (invitees) { return ({
    type: ActionTypes.LoadInvitees,
    payload: invitees,
}); };
export var setUsersSearchQuery = function (query) { return ({
    type: ActionTypes.SetUsersSearchQuery,
    payload: query,
}); };
export function loadUsers() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var users;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/org/users')];
                case 1:
                    users = _a.sent();
                    dispatch(usersLoaded(users));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadInvitees() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var invitees;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/org/invites')];
                case 1:
                    invitees = _a.sent();
                    dispatch(inviteesLoaded(invitees));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateUser(user) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().patch("/api/org/users/" + user.userId, { role: user.role })];
                case 1:
                    _a.sent();
                    dispatch(loadUsers());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function removeUser(userId) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().delete("/api/org/users/" + userId)];
                case 1:
                    _a.sent();
                    dispatch(loadUsers());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function revokeInvite(code) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().patch("/api/org/invites/" + code + "/revoke", {})];
                case 1:
                    _a.sent();
                    dispatch(loadInvitees());
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map