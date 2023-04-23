import { SelectableValue } from '@grafana/data';

import { HaystackDictionary, MetricsData } from '../types';

export const DEFAULT_RESULTS_PER_PAGE = 100;
export const MAXIMUM_RESULTS_PER_PAGE = 1000;

/**
 * The reducer function that uses a switch statement to handle the Metric Encyclopedia actions
 * @param state
 * @param action
 * @returns
 */
export function MetricEncyclopediaReducer(state: MetricEncyclopediaState, action: Action): MetricEncyclopediaState {
  const { type, payload } = action;
  switch (type) {
    case 'filterMetricsBackend':
      return {
        ...state,
        ...payload,
      };
    case 'setMetadata':
      return {
        ...state,
        ...payload,
      };
    case 'setIsLoading':
      return {
        ...state,
        isLoading: payload,
      };
    case 'setFilteredMetricCount':
      return {
        ...state,
        filteredMetricCount: payload,
      };
    case 'setResultsPerPage':
      return {
        ...state,
        resultsPerPage: payload,
      };
    case 'setPageNum':
      return {
        ...state,
        pageNum: payload,
      };
    case 'setFuzzySearchQuery':
      return {
        ...state,
        fuzzySearchQuery: payload,
        pageNum: 1,
        letterSearch: '',
        selectedIdx: 0,
      };
    case 'setNameHaystack':
      return {
        ...state,
        nameHaystackOrder: payload[0],
        nameHaystackMatches: payload[1],
      };
    case 'setMetaHaystack':
      return {
        ...state,
        metaHaystackOrder: payload[0],
        metaHaystackMatches: payload[1],
      };
    case 'setFullMetaSearch':
      return {
        ...state,
        fullMetaSearch: payload,
        pageNum: 1,
      };
    case 'setExcludeNullMetadata':
      return {
        ...state,
        excludeNullMetadata: payload,
        pageNum: 1,
      };
    case 'setSelectedTypes':
      return {
        ...state,
        selectedTypes: payload,
        pageNum: 1,
      };
    case 'setLetterSearch':
      return {
        ...state,
        letterSearch: payload,
        pageNum: 1,
      };
    case 'setUseBackend':
      return {
        ...state,
        useBackend: payload,
        pageNum: 1,
      };
    case 'setDisableTextWrap':
      return {
        ...state,
        disableTextWrap: !state.disableTextWrap,
      };
    case 'setSelectedIdx':
      return {
        ...state,
        selectedIdx: payload,
      };
    case 'showAdditionalSettings':
      return {
        ...state,
        showAdditionalSettings: !state.showAdditionalSettings,
      };
    default:
      return state;
  }
}

/**
 * Initial state for the Metric Encyclopedia
 * @returns
 */
export function initialState(): MetricEncyclopediaState {
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
    excludeNullMetadata: false,
    selectedTypes: [],
    letterSearch: '',
    useBackend: false,
    disableTextWrap: false,
    selectedIdx: 0,
    showAdditionalSettings: false,
  };
}

/**
 * The Metric Encyclopedia state object
 */
export interface MetricEncyclopediaState {
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
export type MetricEncyclopediaMetadata = {
  isLoading: boolean;
  metrics: MetricsData;
  hasMetadata: boolean;
  metaHaystackDictionary: HaystackDictionary;
  nameHaystackDictionary: HaystackDictionary;
  totalMetricCount: number;
  filteredMetricCount: number | null;
};

/**
 * An interface for Metric Encyclopedia actions with a discriminated union type
 */
export type Action =
  | { type: 'setIsLoading'; payload: boolean }
  | {
      type: 'setMetadata';
      payload: MetricEncyclopediaMetadata;
    }
  | {
      type: 'filterMetricsBackend';
      payload: {
        metrics: MetricsData;
        filteredMetricCount: number;
        isLoading: boolean;
      };
    }
  | { type: 'setFilteredMetricCount'; payload: number }
  | { type: 'setResultsPerPage'; payload: number }
  | { type: 'setPageNum'; payload: number }
  | { type: 'setFuzzySearchQuery'; payload: string }
  | { type: 'setNameHaystack'; payload: string[][] }
  | { type: 'setMetaHaystack'; payload: string[][] }
  | { type: 'setFullMetaSearch'; payload: boolean }
  | { type: 'setExcludeNullMetadata'; payload: boolean }
  | { type: 'setSelectedTypes'; payload: Array<SelectableValue<string>> }
  | { type: 'setLetterSearch'; payload: string }
  | { type: 'setUseBackend'; payload: boolean }
  | { type: 'setSelectedIdx'; payload: number }
  | { type: 'setDisableTextWrap'; payload: null }
  | { type: 'showAdditionalSettings'; payload: null };
