import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { SelectableValue } from '@grafana/data';

import { PromVisualQuery } from '../../../types';
import { HaystackDictionary, MetricsData } from '../types';

export const DEFAULT_RESULTS_PER_PAGE = 100;
export const MAXIMUM_RESULTS_PER_PAGE = 1000;

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
      state.letterSearch = '';
      state.selectedIdx = 0;
    },
    setNameHaystack: (state, action: PayloadAction<string[][]>) => {
      state.nameHaystackOrder = action.payload[0];
      state.nameHaystackMatches = action.payload[1];
    },
    setMetaHaystack: (state, action: PayloadAction<string[][]>) => {
      state.metaHaystackOrder = action.payload[0];
      state.metaHaystackMatches = action.payload[1];
    },
    setFullMetaSearch: (state, action: PayloadAction<boolean>) => {
      state.fullMetaSearch = action.payload;
      state.pageNum = 1;
    },
    setExcludeNullMetadata: (state, action: PayloadAction<boolean>) => {
      state.excludeNullMetadata = action.payload;
      state.pageNum = 1;
    },
    setSelectedTypes: (state, action: PayloadAction<Array<SelectableValue<string>>>) => {
      state.selectedTypes = action.payload;
      state.pageNum = 1;
    },
    setLetterSearch: (state, action: PayloadAction<string>) => {
      state.letterSearch = action.payload;
      state.pageNum = 1;
    },
    setUseBackend: (state, action: PayloadAction<boolean>) => {
      state.useBackend = action.payload;
      state.fullMetaSearch = false;
      state.excludeNullMetadata = false;
      state.pageNum = 1;
    },
    setSelectedIdx: (state, action: PayloadAction<number>) => {
      state.selectedIdx = action.payload;
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
 * Initial state for the Metrics Modal
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
    fullMetaSearch: query?.fullMetaSearch ?? false,
    excludeNullMetadata: query?.excludeNullMetadata ?? false,
    selectedTypes: [],
    letterSearch: '',
    useBackend: query?.useBackend ?? false,
    disableTextWrap: query?.disableTextWrap ?? false,
    selectedIdx: 0,
    showAdditionalSettings: false,
  };
}

/**
 * The Metrics Modal state object
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
  /** Excludes results that are missing type and description */
  excludeNullMetadata: boolean;
  /** Filter by prometheus type */
  selectedTypes: Array<SelectableValue<string>>;
  /** After results are filtered, select a letter to show metrics that start with that letter */
  letterSearch: string;
  /** Filter by the series match endpoint instead of the fuzzy search */
  useBackend: boolean;
  /** Disable text wrap for descriptions in the results table */
  disableTextWrap: boolean;
  /** The selected metric in the table represented by hover style highlighting */
  selectedIdx: number;
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

// for updating the settings in the PromQuery model
export function getSettings(visQuery: PromVisualQuery): MetricsModalSettings {
  return {
    useBackend: visQuery?.useBackend ?? false,
    disableTextWrap: visQuery?.disableTextWrap ?? false,
    fullMetaSearch: visQuery?.fullMetaSearch ?? false,
    excludeNullMetadata: visQuery.excludeNullMetadata ?? false,
  };
}

export type MetricsModalSettings = {
  useBackend?: boolean;
  disableTextWrap?: boolean;
  fullMetaSearch?: boolean;
  excludeNullMetadata?: boolean;
};
