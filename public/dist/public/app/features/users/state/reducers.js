var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import config from 'app/core/config';
export var initialState = {
    invitees: [],
    users: [],
    searchQuery: '',
    searchPage: 1,
    canInvite: !config.externalUserMngLinkName,
    externalUserMngInfo: config.externalUserMngInfo,
    externalUserMngLinkName: config.externalUserMngLinkName,
    externalUserMngLinkUrl: config.externalUserMngLinkUrl,
    hasFetched: false,
};
var usersSlice = createSlice({
    name: 'users',
    initialState: initialState,
    reducers: {
        usersLoaded: function (state, action) {
            return __assign(__assign({}, state), { hasFetched: true, users: action.payload });
        },
        inviteesLoaded: function (state, action) {
            return __assign(__assign({}, state), { hasFetched: true, invitees: action.payload });
        },
        setUsersSearchQuery: function (state, action) {
            // reset searchPage otherwise search results won't appear
            return __assign(__assign({}, state), { searchQuery: action.payload, searchPage: initialState.searchPage });
        },
        setUsersSearchPage: function (state, action) {
            return __assign(__assign({}, state), { searchPage: action.payload });
        },
    },
});
export var inviteesLoaded = (_a = usersSlice.actions, _a.inviteesLoaded), setUsersSearchQuery = _a.setUsersSearchQuery, setUsersSearchPage = _a.setUsersSearchPage, usersLoaded = _a.usersLoaded;
export var usersReducer = usersSlice.reducer;
export default {
    users: usersReducer,
};
//# sourceMappingURL=reducers.js.map