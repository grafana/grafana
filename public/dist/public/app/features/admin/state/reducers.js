import { __rest } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
const initialLdapState = {
    connectionInfo: [],
    syncInfo: undefined,
    user: undefined,
    connectionError: undefined,
    userError: undefined,
};
const ldapSlice = createSlice({
    name: 'ldap',
    initialState: initialLdapState,
    reducers: {
        ldapConnectionInfoLoadedAction: (state, action) => (Object.assign(Object.assign({}, state), { ldapError: undefined, connectionInfo: action.payload })),
        ldapFailedAction: (state, action) => (Object.assign(Object.assign({}, state), { ldapError: action.payload })),
        ldapSyncStatusLoadedAction: (state, action) => (Object.assign(Object.assign({}, state), { syncInfo: action.payload })),
        userMappingInfoLoadedAction: (state, action) => (Object.assign(Object.assign({}, state), { user: action.payload, userError: undefined })),
        userMappingInfoFailedAction: (state, action) => (Object.assign(Object.assign({}, state), { user: undefined, userError: action.payload })),
        clearUserMappingInfoAction: (state, action) => (Object.assign(Object.assign({}, state), { user: undefined })),
        clearUserErrorAction: (state, action) => (Object.assign(Object.assign({}, state), { userError: undefined })),
    },
});
export const { clearUserErrorAction, clearUserMappingInfoAction, ldapConnectionInfoLoadedAction, ldapFailedAction, ldapSyncStatusLoadedAction, userMappingInfoFailedAction, userMappingInfoLoadedAction, } = ldapSlice.actions;
export const ldapReducer = ldapSlice.reducer;
// UserAdminPage
const initialUserAdminState = {
    user: undefined,
    sessions: [],
    orgs: [],
    isLoading: true,
    error: undefined,
};
export const userAdminSlice = createSlice({
    name: 'userAdmin',
    initialState: initialUserAdminState,
    reducers: {
        userProfileLoadedAction: (state, action) => (Object.assign(Object.assign({}, state), { user: action.payload })),
        userOrgsLoadedAction: (state, action) => (Object.assign(Object.assign({}, state), { orgs: action.payload })),
        userSessionsLoadedAction: (state, action) => (Object.assign(Object.assign({}, state), { sessions: action.payload })),
        userAdminPageLoadedAction: (state, action) => (Object.assign(Object.assign({}, state), { isLoading: !action.payload })),
        userAdminPageFailedAction: (state, action) => (Object.assign(Object.assign({}, state), { error: action.payload, isLoading: false })),
    },
});
export const { userProfileLoadedAction, userOrgsLoadedAction, userSessionsLoadedAction, userAdminPageLoadedAction, userAdminPageFailedAction, } = userAdminSlice.actions;
export const userAdminReducer = userAdminSlice.reducer;
// UserListAdminPage
const initialUserListAdminState = {
    users: [],
    query: '',
    page: 0,
    perPage: 50,
    totalPages: 1,
    showPaging: false,
    filters: [{ name: 'activeLast30Days', value: false }],
    isLoading: true,
};
export const userListAdminSlice = createSlice({
    name: 'userListAdmin',
    initialState: initialUserListAdminState,
    reducers: {
        usersFetched: (state, action) => {
            const _a = action.payload, { totalCount, perPage, users } = _a, rest = __rest(_a, ["totalCount", "perPage", "users"]);
            const totalPages = Math.ceil(totalCount / perPage);
            return Object.assign(Object.assign(Object.assign({}, state), rest), { 
                // @PERCONA
                users: users || [], totalPages,
                perPage, showPaging: totalPages > 1, isLoading: false });
        },
        usersFetchBegin: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: true });
        },
        usersFetchEnd: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: false });
        },
        queryChanged: (state, action) => (Object.assign(Object.assign({}, state), { query: action.payload, page: 0 })),
        pageChanged: (state, action) => (Object.assign(Object.assign({}, state), { page: action.payload })),
        sortChanged: (state, action) => (Object.assign(Object.assign({}, state), { page: 0, sort: action.payload })),
        filterChanged: (state, action) => {
            const { name, value } = action.payload;
            if (state.filters.some((filter) => filter.name === name)) {
                return Object.assign(Object.assign({}, state), { page: 0, filters: state.filters.map((filter) => (filter.name === name ? Object.assign(Object.assign({}, filter), { value }) : filter)) });
            }
            return Object.assign(Object.assign({}, state), { page: 0, filters: [...state.filters, action.payload] });
        },
    },
});
export const { usersFetched, usersFetchBegin, usersFetchEnd, queryChanged, pageChanged, filterChanged, sortChanged } = userListAdminSlice.actions;
export const userListAdminReducer = userListAdminSlice.reducer;
export default {
    ldap: ldapReducer,
    userAdmin: userAdminReducer,
    userListAdmin: userListAdminReducer,
};
//# sourceMappingURL=reducers.js.map