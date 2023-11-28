import { createSlice } from '@reduxjs/toolkit';
export const DEFAULT_RESULTS_PER_PAGE = 100;
export const MAXIMUM_RESULTS_PER_PAGE = 1000;
export const stateSlice = createSlice({
    name: 'metrics-modal-state',
    initialState: initialState(),
    reducers: {
        filterMetricsBackend: (state, action) => {
            state.metrics = action.payload.metrics;
            state.filteredMetricCount = action.payload.filteredMetricCount;
            state.isLoading = action.payload.isLoading;
        },
        buildMetrics: (state, action) => {
            state.isLoading = action.payload.isLoading;
            state.metrics = action.payload.metrics;
            state.hasMetadata = action.payload.hasMetadata;
            state.metaHaystackDictionary = action.payload.metaHaystackDictionary;
            state.nameHaystackDictionary = action.payload.nameHaystackDictionary;
            state.totalMetricCount = action.payload.totalMetricCount;
            state.filteredMetricCount = action.payload.filteredMetricCount;
        },
        setIsLoading: (state, action) => {
            state.isLoading = action.payload;
        },
        setFilteredMetricCount: (state, action) => {
            state.filteredMetricCount = action.payload;
        },
        setResultsPerPage: (state, action) => {
            state.resultsPerPage = action.payload;
        },
        setPageNum: (state, action) => {
            state.pageNum = action.payload;
        },
        setFuzzySearchQuery: (state, action) => {
            state.fuzzySearchQuery = action.payload;
            state.pageNum = 1;
        },
        setNameHaystack: (state, action) => {
            state.nameHaystackOrder = action.payload[0];
            state.nameHaystackMatches = action.payload[1];
        },
        setMetaHaystack: (state, action) => {
            state.metaHaystackOrder = action.payload[0];
            state.metaHaystackMatches = action.payload[1];
        },
        setFullMetaSearch: (state, action) => {
            state.fullMetaSearch = action.payload;
            state.pageNum = 1;
        },
        setIncludeNullMetadata: (state, action) => {
            state.includeNullMetadata = action.payload;
            state.pageNum = 1;
        },
        setSelectedTypes: (state, action) => {
            state.selectedTypes = action.payload;
            state.pageNum = 1;
        },
        setUseBackend: (state, action) => {
            state.useBackend = action.payload;
            state.fullMetaSearch = false;
            state.pageNum = 1;
        },
        setDisableTextWrap: (state) => {
            state.disableTextWrap = !state.disableTextWrap;
        },
        showAdditionalSettings: (state) => {
            state.showAdditionalSettings = !state.showAdditionalSettings;
        },
    },
});
/**
 * Initial state for the metrics explorer
 * @returns
 */
export function initialState(query) {
    var _a, _b, _c, _d;
    return {
        isLoading: true,
        metrics: [],
        hasMetadata: true,
        metaHaystackDictionary: {},
        metaHaystackMatches: [],
        metaHaystackOrder: [],
        nameHaystackDictionary: {},
        nameHaystackOrder: [],
        nameHaystackMatches: [],
        totalMetricCount: 0,
        filteredMetricCount: null,
        resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
        pageNum: 1,
        fuzzySearchQuery: '',
        fullMetaSearch: (_a = query === null || query === void 0 ? void 0 : query.fullMetaSearch) !== null && _a !== void 0 ? _a : false,
        includeNullMetadata: (_b = query === null || query === void 0 ? void 0 : query.includeNullMetadata) !== null && _b !== void 0 ? _b : true,
        selectedTypes: [],
        useBackend: (_c = query === null || query === void 0 ? void 0 : query.useBackend) !== null && _c !== void 0 ? _c : false,
        disableTextWrap: (_d = query === null || query === void 0 ? void 0 : query.disableTextWrap) !== null && _d !== void 0 ? _d : false,
        showAdditionalSettings: false,
    };
}
// for updating the settings in the PromQuery model
export function getSettings(visQuery) {
    var _a, _b, _c, _d;
    return {
        useBackend: (_a = visQuery === null || visQuery === void 0 ? void 0 : visQuery.useBackend) !== null && _a !== void 0 ? _a : false,
        disableTextWrap: (_b = visQuery === null || visQuery === void 0 ? void 0 : visQuery.disableTextWrap) !== null && _b !== void 0 ? _b : false,
        fullMetaSearch: (_c = visQuery === null || visQuery === void 0 ? void 0 : visQuery.fullMetaSearch) !== null && _c !== void 0 ? _c : false,
        includeNullMetadata: (_d = visQuery.includeNullMetadata) !== null && _d !== void 0 ? _d : false,
    };
}
//# sourceMappingURL=state.js.map