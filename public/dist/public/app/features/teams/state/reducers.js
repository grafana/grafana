import { __rest } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
export const initialTeamsState = {
    teams: [],
    page: 1,
    query: '',
    perPage: 30,
    totalPages: 0,
    noTeams: false,
    hasFetched: false,
};
const teamsSlice = createSlice({
    name: 'teams',
    initialState: initialTeamsState,
    reducers: {
        teamsLoaded: (state, action) => {
            const _a = action.payload, { totalCount, perPage } = _a, rest = __rest(_a, ["totalCount", "perPage"]);
            const totalPages = Math.ceil(totalCount / perPage);
            return Object.assign(Object.assign(Object.assign({}, state), rest), { totalPages, perPage, hasFetched: true });
        },
        queryChanged: (state, action) => {
            return Object.assign(Object.assign({}, state), { page: 1, query: action.payload });
        },
        pageChanged: (state, action) => {
            return Object.assign(Object.assign({}, state), { page: action.payload });
        },
        sortChanged: (state, action) => {
            return Object.assign(Object.assign({}, state), { sort: action.payload, page: 1 });
        },
    },
});
export const { teamsLoaded, queryChanged, pageChanged, sortChanged } = teamsSlice.actions;
export const teamsReducer = teamsSlice.reducer;
export const initialTeamState = {
    team: {},
    members: [],
    groups: [],
    searchMemberQuery: '',
};
const teamSlice = createSlice({
    name: 'team',
    initialState: initialTeamState,
    reducers: {
        teamLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { team: action.payload });
        },
        teamMembersLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { members: action.payload });
        },
        setSearchMemberQuery: (state, action) => {
            return Object.assign(Object.assign({}, state), { searchMemberQuery: action.payload });
        },
        teamGroupsLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { groups: action.payload });
        },
    },
});
export const { teamLoaded, teamGroupsLoaded, teamMembersLoaded, setSearchMemberQuery } = teamSlice.actions;
export const teamReducer = teamSlice.reducer;
export default {
    teams: teamsReducer,
    team: teamReducer,
};
//# sourceMappingURL=reducers.js.map