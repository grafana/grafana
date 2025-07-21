// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/metrics-modal/state/state.ts
import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { SelectableValue } from '@grafana/data';

import { PromVisualQuery } from '../../../types';
import { HaystackDictionary, MetricsData } from '../types';

/**
 * Initial state for the metrics explorer
 * @returns
 */
export function initialState(query?: PromVisualQuery): MetricsModalState {
  return {
    metaHaystackDictionary: {},
    metaHaystackMatches: [],
    metaHaystackOrder: [],
    nameHaystackDictionary: {},
    nameHaystackOrder: [],
    nameHaystackMatches: [],
    totalMetricCount: 0,
    filteredMetricCount: null,
    fuzzySearchQuery: '',
    includeNullMetadata: true,
    selectedTypes: [],
    useBackend: false,
  };
}

/**
 * The metrics explorer state object
 */
export interface MetricsModalState {
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
  /** The text query used to match metrics */
  fuzzySearchQuery: string;
  /** Includes results that are missing type and description */
  includeNullMetadata: boolean;
  /** Filter by prometheus type */
  selectedTypes: Array<SelectableValue<string>>;
  /** Filter by the series match endpoint instead of the fuzzy search */
  useBackend: boolean;
}

/**
 * Type for the useEffect get metadata function
 */
export type MetricsModalMetadata = {
  // isLoading: boolean;
  // metrics: MetricsData;
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
      // state.metrics = action.payload.metrics;
      state.filteredMetricCount = action.payload.filteredMetricCount;
      // state.isLoading = action.payload.isLoading;
    },
    buildMetrics: (state, action: PayloadAction<MetricsModalMetadata>) => {
      // state.isLoading = action.payload.isLoading;
      // state.metrics = action.payload.metrics;
      // state.hasMetadata = action.payload.hasMetadata;
      state.metaHaystackDictionary = action.payload.metaHaystackDictionary;
      state.nameHaystackDictionary = action.payload.nameHaystackDictionary;
      state.totalMetricCount = action.payload.totalMetricCount;
      state.filteredMetricCount = action.payload.filteredMetricCount;
    },
    setFuzzySearchQuery: (state, action: PayloadAction<string>) => {
      state.fuzzySearchQuery = action.payload;
      // state.pageNum = 1;
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
      // state.pageNum = 1;
    },
  },
});

export const {
  buildMetrics,
  filterMetricsBackend,
  setFuzzySearchQuery,
  setNameHaystack,
  setMetaHaystack,
  setSelectedTypes,
} = stateSlice.actions;
