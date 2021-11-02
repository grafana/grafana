var _a, _b, _c;
import { __assign, __read, __rest, __spreadArray } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
var initialLdapState = {
    connectionInfo: [],
    syncInfo: undefined,
    user: undefined,
    connectionError: undefined,
    userError: undefined,
};
var ldapSlice = createSlice({
    name: 'ldap',
    initialState: initialLdapState,
    reducers: {
        ldapConnectionInfoLoadedAction: function (state, action) { return (__assign(__assign({}, state), { ldapError: undefined, connectionInfo: action.payload })); },
        ldapFailedAction: function (state, action) { return (__assign(__assign({}, state), { ldapError: action.payload })); },
        ldapSyncStatusLoadedAction: function (state, action) { return (__assign(__assign({}, state), { syncInfo: action.payload })); },
        userMappingInfoLoadedAction: function (state, action) { return (__assign(__assign({}, state), { user: action.payload, userError: undefined })); },
        userMappingInfoFailedAction: function (state, action) { return (__assign(__assign({}, state), { user: undefined, userError: action.payload })); },
        clearUserMappingInfoAction: function (state, action) { return (__assign(__assign({}, state), { user: undefined })); },
        clearUserErrorAction: function (state, action) { return (__assign(__assign({}, state), { userError: undefined })); },
    },
});
export var clearUserErrorAction = (_a = ldapSlice.actions, _a.clearUserErrorAction), clearUserMappingInfoAction = _a.clearUserMappingInfoAction, ldapConnectionInfoLoadedAction = _a.ldapConnectionInfoLoadedAction, ldapFailedAction = _a.ldapFailedAction, ldapSyncStatusLoadedAction = _a.ldapSyncStatusLoadedAction, userMappingInfoFailedAction = _a.userMappingInfoFailedAction, userMappingInfoLoadedAction = _a.userMappingInfoLoadedAction;
export var ldapReducer = ldapSlice.reducer;
// UserAdminPage
var initialUserAdminState = {
    user: undefined,
    sessions: [],
    orgs: [],
    isLoading: true,
    error: undefined,
};
export var userAdminSlice = createSlice({
    name: 'userAdmin',
    initialState: initialUserAdminState,
    reducers: {
        userProfileLoadedAction: function (state, action) { return (__assign(__assign({}, state), { user: action.payload })); },
        userOrgsLoadedAction: function (state, action) { return (__assign(__assign({}, state), { orgs: action.payload })); },
        userSessionsLoadedAction: function (state, action) { return (__assign(__assign({}, state), { sessions: action.payload })); },
        userAdminPageLoadedAction: function (state, action) { return (__assign(__assign({}, state), { isLoading: !action.payload })); },
        userAdminPageFailedAction: function (state, action) { return (__assign(__assign({}, state), { error: action.payload, isLoading: false })); },
    },
});
export var userProfileLoadedAction = (_b = userAdminSlice.actions, _b.userProfileLoadedAction), userOrgsLoadedAction = _b.userOrgsLoadedAction, userSessionsLoadedAction = _b.userSessionsLoadedAction, userAdminPageLoadedAction = _b.userAdminPageLoadedAction, userAdminPageFailedAction = _b.userAdminPageFailedAction;
export var userAdminReducer = userAdminSlice.reducer;
// UserListAdminPage
var initialUserListAdminState = {
    users: [],
    query: '',
    page: 0,
    perPage: 50,
    totalPages: 1,
    showPaging: false,
    filters: [{ name: 'activeLast30Days', value: false }],
    isLoading: false,
};
export var userListAdminSlice = createSlice({
    name: 'userListAdmin',
    initialState: initialUserListAdminState,
    reducers: {
        usersFetched: function (state, action) {
            var _a = action.payload, totalCount = _a.totalCount, perPage = _a.perPage, rest = __rest(_a, ["totalCount", "perPage"]);
            var totalPages = Math.ceil(totalCount / perPage);
            return __assign(__assign(__assign({}, state), rest), { totalPages: totalPages, perPage: perPage, showPaging: totalPages > 1, isLoading: false });
        },
        usersFetchBegin: function (state) {
            return __assign(__assign({}, state), { isLoading: true });
        },
        usersFetchEnd: function (state) {
            return __assign(__assign({}, state), { isLoading: false });
        },
        queryChanged: function (state, action) { return (__assign(__assign({}, state), { query: action.payload, page: 0 })); },
        pageChanged: function (state, action) { return (__assign(__assign({}, state), { page: action.payload })); },
        filterChanged: function (state, action) {
            var _a = action.payload, name = _a.name, value = _a.value;
            if (state.filters.some(function (filter) { return filter.name === name; })) {
                return __assign(__assign({}, state), { filters: state.filters.map(function (filter) { return (filter.name === name ? __assign(__assign({}, filter), { value: value }) : filter); }) });
            }
            return __assign(__assign({}, state), { filters: __spreadArray(__spreadArray([], __read(state.filters), false), [action.payload], false) });
        },
    },
});
export var usersFetched = (_c = userListAdminSlice.actions, _c.usersFetched), usersFetchBegin = _c.usersFetchBegin, usersFetchEnd = _c.usersFetchEnd, queryChanged = _c.queryChanged, pageChanged = _c.pageChanged, filterChanged = _c.filterChanged;
export var userListAdminReducer = userListAdminSlice.reducer;
export default {
    ldap: ldapReducer,
    userAdmin: userAdminReducer,
    userListAdmin: userListAdminReducer,
};
//# sourceMappingURL=reducers.js.map