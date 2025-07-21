// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/state/state.ts
import {PayloadAction, createSlice} from '@reduxjs/toolkit';

import {SelectableValue} from '@grafana/data';

import {PromVisualQuery} from '../../../types';
import {HaystackDictionary, MetricsData} from '../types';

export const DEFAULT_RESULTS_PER_PAGE = 100;
export const MAXIMUM_RESULTS_PER_PAGE = 1000;

/**
 * Initial state for the metrics explorer
 * @returns
 */
export function initialState(query?: PromVisualQuery): MetricsModalState {
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
        fullMetaSearch: false,
        includeNullMetadata: true,
        selectedTypes: [],
        useBackend: false,
        disableTextWrap: false,
        showAdditionalSettings: false,
    };
}

/**
 * The metrics explorer state object
 */
export interface MetricsModalState {
    /** Used for the loading spinner */
    isLoading: boolean;
    /**
     * Initial collection of metrics.
     * The frontend filters do not impact this, but
     * it is reduced by the backend search.
     */
    metrics: MetricsData;
    /** Field for disabling type select and switches that rely on metadata */
    hasMetadata: boolean;
    /** Used to display metrics and help with fuzzy order */
    nameHaystackDictionary: HaystackDictionary;
    /** Used to sort name fuzzy search by relevance */
    nameHaystackOrder: string[];
    /** Used to highlight text in fuzzy matches */
    nameHaystackMatches: string[];
    /** Used to display metrics and help with fuzzy order for search across all metadata */
    metaHaystackDictionary: HaystackDictionary;
    /** Used to sort meta fuzzy search by relevance */
    metaHaystackOrder: string[];
    /** Used to highlight text in fuzzy matches */
    metaHaystackMatches: string[];
    /** Total results computed on initialization */
    totalMetricCount: number;
    /** Set after filtering metrics */
    filteredMetricCount: number | null;
    /** Pagination field for showing results in table */
    resultsPerPage: number;
    /** Pagination field */
    pageNum: number;
    /** The text query used to match metrics */
    fuzzySearchQuery: string;
    /** Enables the fuzzy meatadata search */
    fullMetaSearch: boolean;
    /** Includes results that are missing type and description */
    includeNullMetadata: boolean;
    /** Filter by prometheus type */
    selectedTypes: Array<SelectableValue<string>>;
    /** Filter by the series match endpoint instead of the fuzzy search */
    useBackend: boolean;
    /** Disable text wrap for descriptions in the results table */
    disableTextWrap: boolean;
    /** Display toggle switches for settings */
    showAdditionalSettings: boolean;
}

/**
 * Type for the useEffect get metadata function
 */
export type MetricsModalMetadata = {
    isLoading: boolean;
    metrics: MetricsData;
    hasMetadata: boolean;
    metaHaystackDictionary: HaystackDictionary;
    nameHaystackDictionary: HaystackDictionary;
    totalMetricCount: number;
    filteredMetricCount: number | null;
};

export const stateSlice = createSlice({
    name: 'metrics-modal-state',
    initialState: initialState(),
    reducers: {
        filterMetricsBackend: (
            state,
            action: PayloadAction<{
                metrics: MetricsData;
                filteredMetricCount: number;
                isLoading: boolean;
            }>
        ) => {
            state.metrics = action.payload.metrics;
            state.filteredMetricCount = action.payload.filteredMetricCount;
            state.isLoading = action.payload.isLoading;
        },
        buildMetrics: (state, action: PayloadAction<MetricsModalMetadata>) => {
            state.isLoading = action.payload.isLoading;
            state.metrics = action.payload.metrics;
            state.hasMetadata = action.payload.hasMetadata;
            state.metaHaystackDictionary = action.payload.metaHaystackDictionary;
            state.nameHaystackDictionary = action.payload.nameHaystackDictionary;
            state.totalMetricCount = action.payload.totalMetricCount;
            state.filteredMetricCount = action.payload.filteredMetricCount;
        },
        setIsLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setFilteredMetricCount: (state, action: PayloadAction<number>) => {
            state.filteredMetricCount = action.payload;
        },
        setResultsPerPage: (state, action: PayloadAction<number>) => {
            state.resultsPerPage = action.payload;
        },
        setPageNum: (state, action: PayloadAction<number>) => {
            state.pageNum = action.payload;
        },
        setFuzzySearchQuery: (state, action: PayloadAction<string>) => {
            state.fuzzySearchQuery = action.payload;
            state.pageNum = 1;
        },
        setNameHaystack: (state, action: PayloadAction<string[][]>) => {
            state.nameHaystackOrder = action.payload[0];
            state.nameHaystackMatches = action.payload[1];
        },
        setMetaHaystack: (state, action: PayloadAction<string[][]>) => {
            state.metaHaystackOrder = action.payload[0];
            state.metaHaystackMatches = action.payload[1];
        },
        setSelectedTypes: (state, action: PayloadAction<Array<SelectableValue<string>>>) => {
            state.selectedTypes = action.payload;
            state.pageNum = 1;
        },
    },
});

export const {
    setIsLoading,
    buildMetrics,
    filterMetricsBackend,
    setResultsPerPage,
    setPageNum,
    setFuzzySearchQuery,
    setNameHaystack,
    setMetaHaystack,
    setSelectedTypes,
    setFilteredMetricCount,
} = stateSlice.actions;
