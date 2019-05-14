import * as tslib_1 from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
import { updateNavIndex } from 'app/core/actions';
import { buildNavModel } from './navModel';
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["LoadTeams"] = "LOAD_TEAMS";
    ActionTypes["LoadTeam"] = "LOAD_TEAM";
    ActionTypes["SetSearchQuery"] = "SET_TEAM_SEARCH_QUERY";
    ActionTypes["SetSearchMemberQuery"] = "SET_TEAM_MEMBER_SEARCH_QUERY";
    ActionTypes["LoadTeamMembers"] = "TEAM_MEMBERS_LOADED";
    ActionTypes["LoadTeamGroups"] = "TEAM_GROUPS_LOADED";
})(ActionTypes || (ActionTypes = {}));
var teamsLoaded = function (teams) { return ({
    type: ActionTypes.LoadTeams,
    payload: teams,
}); };
var teamLoaded = function (team) { return ({
    type: ActionTypes.LoadTeam,
    payload: team,
}); };
var teamMembersLoaded = function (teamMembers) { return ({
    type: ActionTypes.LoadTeamMembers,
    payload: teamMembers,
}); };
var teamGroupsLoaded = function (teamGroups) { return ({
    type: ActionTypes.LoadTeamGroups,
    payload: teamGroups,
}); };
export var setSearchMemberQuery = function (searchQuery) { return ({
    type: ActionTypes.SetSearchMemberQuery,
    payload: searchQuery,
}); };
export var setSearchQuery = function (searchQuery) { return ({
    type: ActionTypes.SetSearchQuery,
    payload: searchQuery,
}); };
export function loadTeams() {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var response;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var team, response;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var team;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var team;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var team;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var team, response;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var team;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var team;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    team = getStore().team.team;
                    return [4 /*yield*/, getBackendSrv().delete("/api/teams/" + team.id + "/groups/" + groupId)];
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
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
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
//# sourceMappingURL=actions.js.map