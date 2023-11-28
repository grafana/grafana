import { createSlice } from '@reduxjs/toolkit';
export const initialState = {
    supportBundles: [],
    isLoading: false,
    supportBundleCollectors: [],
    createBundlePageLoading: false,
    loadBundlesError: '',
    createBundleError: '',
};
const supportBundlesSlice = createSlice({
    name: 'supportBundles',
    initialState,
    reducers: {
        supportBundlesLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { supportBundles: action.payload, isLoading: false });
        },
        fetchBegin: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: true });
        },
        fetchEnd: (state) => {
            return Object.assign(Object.assign({}, state), { isLoading: false });
        },
        collectorsFetchBegin: (state) => {
            return Object.assign(Object.assign({}, state), { createBundlePageLoading: true });
        },
        collectorsFetchEnd: (state) => {
            return Object.assign(Object.assign({}, state), { createBundlePageLoading: false });
        },
        supportBundleCollectorsLoaded: (state, action) => {
            return Object.assign(Object.assign({}, state), { supportBundleCollectors: action.payload, createBundlePageLoading: false });
        },
        setLoadBundleError: (state, action) => {
            return Object.assign(Object.assign({}, state), { loadBundlesError: action.payload, supportBundleCollectors: [] });
        },
        setCreateBundleError: (state, action) => {
            return Object.assign(Object.assign({}, state), { createBundleError: action.payload });
        },
    },
});
export const { supportBundlesLoaded, fetchBegin, fetchEnd, supportBundleCollectorsLoaded, collectorsFetchBegin, collectorsFetchEnd, setLoadBundleError, setCreateBundleError, } = supportBundlesSlice.actions;
export const supportBundlesReducer = supportBundlesSlice.reducer;
export default {
    supportBundles: supportBundlesReducer,
};
//# sourceMappingURL=reducers.js.map