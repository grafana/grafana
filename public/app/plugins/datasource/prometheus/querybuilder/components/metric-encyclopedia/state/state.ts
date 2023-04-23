import { Action, MetricEncyclopediaState } from './types';

export const DEFAULT_RESULTS_PER_PAGE = 100;
export const MAXIMUM_RESULTS_PER_PAGE = 1000;

// Our reducer function that uses a switch statement to handle our actions
export function MetricEncyclopediaReducer(state: MetricEncyclopediaState, action: Action) {
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
      };
    case 'setNameHaystackOrder':
      return {
        ...state,
        nameHaystackOrder: payload,
      };
    case 'setMetaHaystackOrder':
      return {
        ...state,
        metaHaystackOrder: payload,
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
    case 'setHovered':
      return {
        ...state,
        hovered: payload,
      };
    default:
      return state;
  }
}

export const initialState = {
  isLoading: true,
  metrics: [],
  hasMetadata: true,
  metaHaystack: [],
  nameHaystack: [],
  metaHaystackDictionary: {},
  nameHaystackDictionary: {},
  totalMetricCount: 0,
  filteredMetricCount: null,
  resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
  pageNum: 1,
  fuzzySearchQuery: '',
  nameHaystackOrder: [],
  metaHaystackOrder: [],
  fullMetaSearch: false,
  excludeNullMetadata: false,
  selectedTypes: [],
  letterSearch: '',
  useBackend: false,
  disableTextWrap: false,
  selectedIdx: 0,
  showAdditionalSettings: false,
  hovered: false,
};
