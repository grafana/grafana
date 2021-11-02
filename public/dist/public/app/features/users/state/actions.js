import { __awaiter, __generator } from "tslib";
import { AccessControlAction } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { inviteesLoaded, usersLoaded } from './reducers';
import { contextSrv } from 'app/core/core';
export function loadUsers() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var users;
        return __generator(this, function (_a) {
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
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var invitees;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!contextSrv.hasPermission(AccessControlAction.OrgUsersAdd)) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getBackendSrv().get('/api/org/invites')];
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
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
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
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
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
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
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