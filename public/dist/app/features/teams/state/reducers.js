import * as tslib_1 from "tslib";
import { ActionTypes } from './actions';
export var initialTeamsState = { teams: [], searchQuery: '', hasFetched: false };
export var initialTeamState = {
    team: {},
    members: [],
    groups: [],
    searchMemberQuery: '',
};
export var teamsReducer = function (state, action) {
    if (state === void 0) { state = initialTeamsState; }
    switch (action.type) {
        case ActionTypes.LoadTeams:
            return tslib_1.__assign({}, state, { hasFetched: true, teams: action.payload });
        case ActionTypes.SetSearchQuery:
            return tslib_1.__assign({}, state, { searchQuery: action.payload });
    }
    return state;
};
export var teamReducer = function (state, action) {
    if (state === void 0) { state = initialTeamState; }
    switch (action.type) {
        case ActionTypes.LoadTeam:
            return tslib_1.__assign({}, state, { team: action.payload });
        case ActionTypes.LoadTeamMembers:
            return tslib_1.__assign({}, state, { members: action.payload });
        case ActionTypes.SetSearchMemberQuery:
            return tslib_1.__assign({}, state, { searchMemberQuery: action.payload });
        case ActionTypes.LoadTeamGroups:
            return tslib_1.__assign({}, state, { groups: action.payload });
    }
    return state;
};
export default {
    teams: teamsReducer,
    team: teamReducer,
};
//# sourceMappingURL=reducers.js.map