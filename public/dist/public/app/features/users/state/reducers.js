import { createSlice } from '@reduxjs/toolkit';
import config from 'app/core/config';
export const initialState = {
    users: [],
    searchQuery: '',
    page: 0,
    perPage: 30,
    totalPages: 1,
    externalUserMngInfo: config.externalUserMngInfo,
    externalUserMngLinkName: config.externalUserMngLinkName,
    externalUserMngLinkUrl: config.externalUserMngLinkUrl,
    isLoading: false,
};
const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {
        usersLoaded: (state, action) => {
            const { totalCount, perPage, page, orgUsers } = action.payload;
            const totalPages = Math.ceil(totalCount / perPage);
            return Object.assign(Object.assign({}, state), { isLoading: true, users: orgUsers, perPage,
                page,
                totalPages });
        },
        searchQueryChanged: (state, action) => {
            // reset searchPage otherwise search results won't appear
            return Object.assign(Object.assign({}, state), { searchQuery: action.payload, page: initialState.page });
        },
        setUsersSearchPage: (state, action) => {
            return Object.assign(Object.assign({}, state), { page: action.payload });
        },
        pageChanged: (state, action) => (Object.assign(Object.assign({}, state), { page: action.payload })),
        sortChanged: (state, action) => (Object.assign(Object.assign({}, state), { sort: action.payload })),
        usersFetchBegin: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: true });
        },
        usersFetchEnd: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: false });
        },
    },
});
export const { searchQueryChanged, setUsersSearchPage, usersLoaded, usersFetchBegin, usersFetchEnd, pageChanged, sortChanged, } = usersSlice.actions;
export const usersReducer = usersSlice.reducer;
export default {
    users: usersReducer,
};
//# sourceMappingURL=reducers.js.map