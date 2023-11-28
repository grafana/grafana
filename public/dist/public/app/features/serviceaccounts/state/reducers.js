import { __rest } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { ServiceAccountStateFilter, } from 'app/types';
// serviceAccountsProfilePage
export const initialStateProfile = {
    serviceAccount: {},
    isLoading: true,
    tokens: [],
};
export const serviceAccountProfileSlice = createSlice({
    name: 'serviceaccount',
    initialState: initialStateProfile,
    reducers: {
        serviceAccountFetchBegin: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: true });
        },
        serviceAccountFetchEnd: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: false });
        },
        serviceAccountLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { serviceAccount: action.payload, isLoading: false });
        },
        serviceAccountTokensLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { tokens: action.payload, isLoading: false });
        },
    },
});
export const serviceAccountProfileReducer = serviceAccountProfileSlice.reducer;
export const { serviceAccountLoaded, serviceAccountTokensLoaded, serviceAccountFetchBegin, serviceAccountFetchEnd } = serviceAccountProfileSlice.actions;
// serviceAccountsListPage
export const initialStateList = {
    serviceAccounts: [],
    isLoading: true,
    roleOptions: [],
    query: '',
    page: 0,
    perPage: 50,
    totalPages: 1,
    showPaging: false,
    serviceAccountStateFilter: ServiceAccountStateFilter.All,
};
const serviceAccountsSlice = createSlice({
    name: 'serviceaccounts',
    initialState: initialStateList,
    reducers: {
        serviceAccountsFetched: (state, action) => {
            const _a = action.payload, { totalCount, perPage } = _a, rest = __rest(_a, ["totalCount", "perPage"]);
            const totalPages = Math.ceil(totalCount / perPage);
            return Object.assign(Object.assign(Object.assign({}, state), rest), { totalPages,
                perPage, showPaging: totalPages > 1, isLoading: false });
        },
        serviceAccountsFetchBegin: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: true });
        },
        serviceAccountsFetchEnd: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: false });
        },
        acOptionsLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { roleOptions: action.payload });
        },
        queryChanged: (state, action) => {
            return Object.assign(Object.assign({}, state), { query: action.payload, page: 0 });
        },
        pageChanged: (state, action) => (Object.assign(Object.assign({}, state), { page: action.payload })),
        stateFilterChanged: (state, action) => (Object.assign(Object.assign({}, state), { serviceAccountStateFilter: action.payload })),
    },
});
export const serviceAccountsReducer = serviceAccountsSlice.reducer;
export const { serviceAccountsFetchBegin, serviceAccountsFetchEnd, serviceAccountsFetched, acOptionsLoaded, pageChanged, stateFilterChanged, queryChanged, } = serviceAccountsSlice.actions;
export default {
    serviceAccountProfile: serviceAccountProfileReducer,
    serviceAccounts: serviceAccountsReducer,
};
//# sourceMappingURL=reducers.js.map