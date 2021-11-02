import { __awaiter, __generator } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { updateNavIndex } from 'app/core/actions';
import { buildNavModel } from './navModel';
import { teamGroupsLoaded, teamLoaded, teamMembersLoaded, teamsLoaded } from './reducers';
export function loadTeams() {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('/api/teams/search', { perpage: 1000, page: 1 })];
                case 1:
                    response = _a.sent();
                    dispatch(teamsLoaded(response.teams));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadTeam(id) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/teams/" + id)];
                case 1:
                    response = _a.sent();
                    dispatch(teamLoaded(response));
                    dispatch(updateNavIndex(buildNavModel(response)));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadTeamMembers() {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var team, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().get("/api/teams/" + team.id + "/members")];
                case 1:
                    response = _a.sent();
                    dispatch(teamMembersLoaded(response));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function addTeamMember(id) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var team;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().post("/api/teams/" + team.id + "/members", { userId: id })];
                case 1:
                    _a.sent();
                    dispatch(loadTeamMembers());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function removeTeamMember(id) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var team;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().delete("/api/teams/" + team.id + "/members/" + id)];
                case 1:
                    _a.sent();
                    dispatch(loadTeamMembers());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateTeam(name, email) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var team;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().put("/api/teams/" + team.id, { name: name, email: email })];
                case 1:
                    _a.sent();
                    dispatch(loadTeam(team.id));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function loadTeamGroups() {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var team, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().get("/api/teams/" + team.id + "/groups")];
                case 1:
                    response = _a.sent();
                    dispatch(teamGroupsLoaded(response));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function addTeamGroup(groupId) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var team;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().post("/api/teams/" + team.id + "/groups", { groupId: groupId })];
                case 1:
                    _a.sent();
                    dispatch(loadTeamGroups());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function removeTeamGroup(groupId) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var team;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().delete("/api/teams/" + team.id + "/groups/" + encodeURIComponent(groupId))];
                case 1:
                    _a.sent();
                    dispatch(loadTeamGroups());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function deleteTeam(id) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().delete("/api/teams/" + id)];
                case 1:
                    _a.sent();
                    dispatch(loadTeams());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function updateTeamMember(member) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().put("/api/teams/" + member.teamId + "/members/" + member.userId, {
                        permission: member.permission,
                    })];
                case 1:
                    _a.sent();
                    dispatch(loadTeamMembers());
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map