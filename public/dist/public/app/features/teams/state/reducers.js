var _a, _b;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
export var initialTeamsState = { teams: [], searchQuery: '', hasFetched: false };
var teamsSlice = createSlice({
    name: 'teams',
    initialState: initialTeamsState,
    reducers: {
        teamsLoaded: function (state, action) {
            return __assign(__assign({}, state), { hasFetched: true, teams: action.payload });
        },
        setSearchQuery: function (state, action) {
            return __assign(__assign({}, state), { searchQuery: action.payload });
        },
    },
});
export var teamsLoaded = (_a = teamsSlice.actions, _a.teamsLoaded), setSearchQuery = _a.setSearchQuery;
export var teamsReducer = teamsSlice.reducer;
export var initialTeamState = {
    team: {},
    members: [],
    groups: [],
    searchMemberQuery: '',
};
var teamSlice = createSlice({
    name: 'team',
    initialState: initialTeamState,
    reducers: {
        teamLoaded: function (state, action) {
            return __assign(__assign({}, state), { team: action.payload });
        },
        teamMembersLoaded: function (state, action) {
            return __assign(__assign({}, state), { members: action.payload });
        },
        setSearchMemberQuery: function (state, action) {
            return __assign(__assign({}, state), { searchMemberQuery: action.payload });
        },
        teamGroupsLoaded: function (state, action) {
            return __assign(__assign({}, state), { groups: action.payload });
        },
    },
});
export var teamLoaded = (_b = teamSlice.actions, _b.teamLoaded), teamGroupsLoaded = _b.teamGroupsLoaded, teamMembersLoaded = _b.teamMembersLoaded, setSearchMemberQuery = _b.setSearchMemberQuery;
export var teamReducer = teamSlice.reducer;
export default {
    teams: teamsReducer,
    team: teamReducer,
};
//# sourceMappingURL=reducers.js.map