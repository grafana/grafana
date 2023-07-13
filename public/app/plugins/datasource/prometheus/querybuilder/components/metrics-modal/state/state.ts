import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { SelectableValue } from '@grafana/data';

import { QueryBuilderLabelFilter } from '../../../shared/types';
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
    buildLabels: (state, action: PayloadAction<MetricsLabelsData>) => {
      state.isLoading = action.payload.isLoading;
      state.labelNames = action.payload.labelNames;
    },
    buildMetrics: (state, action: PayloadAction<MetricsModalMetadata>) => {
      state.isLoading = action.payload.isLoading;
      state.metrics = action.payload.metrics;
      state.hasMetadata = action.payload.hasMetadata;
      state.metaHaystackDictionary = action.payload.metaHaystackDictionary;
      state.nameHaystackDictionary = action.payload.nameHaystackDictionary;
      state.totalMetricCount = action.payload.totalMetricCount;
      state.filteredMetricCount = action.payload.filteredMetricCount;
      state.metricsStale = false;
    },
    clear: (state) => {
      state.metrics = [];
      state.pageNum = 1;
      state.selectedLabelValues = [];
      state.metricsStale = true;
    },
    setLabelValues: (state, action: PayloadAction<MetricsLabelValuesData>) => {
      state.isLoading = action.payload.isLoading;
      state.labelValues[action.payload.labelName] = action.payload.labelValues;
    },
    setSelectedLabelValue: (
      state,
      action: PayloadAction<{
        labelName: string;
        labelValue: string;
        checked: boolean;
      }>
    ) => {
      const existingLabel = state.selectedLabelValues.find((label) => label.label === action.payload.labelName);
      const numberOfExistingValues = existingLabel ? existingLabel.value?.split('|')?.length : 0;

      if (action.payload.checked) {
        // If the label already exists, add the new value to the existing label, and change the operator to regex
        if (existingLabel) {
          existingLabel.op = '=~';
          existingLabel.value = existingLabel.value + '|' + action.payload.labelValue;
        } else {
          // No values for this label yet, so add it
          state.selectedLabelValues.push({
            label: action.payload.labelName,
            value: action.payload.labelValue,
            op: '=',
          });
        }
        // unselected, so remove it from the state
      } else {
        // If there is already a label, remove it from the value string
        if (existingLabel && numberOfExistingValues > 1) {
          existingLabel.value = existingLabel.value
            .split('|')
            .filter((value) => value !== action.payload.labelValue)
            .join('|');
          if (numberOfExistingValues === 2) {
            existingLabel.op = '=';
          }
        } else {
          state.selectedLabelValues.splice(
            state.selectedLabelValues.findIndex(
              (label) => label.label === action.payload.labelName && label.value.includes(action.payload.labelValue)
            ),
            1
          );
        }
      }
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
    setLabelSearchQuery: (state, action: PayloadAction<string>) => {
      state.labelSearchQuery = action.payload;
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
    setFullMetaSearch: (state, action: PayloadAction<boolean>) => {
      state.fullMetaSearch = action.payload;
      state.pageNum = 1;
    },
    setIncludeNullMetadata: (state, action: PayloadAction<boolean>) => {
      state.includeNullMetadata = action.payload;
      state.pageNum = 1;
    },
    setSelectedTypes: (state, action: PayloadAction<Array<SelectableValue<string>>>) => {
      state.selectedTypes = action.payload;
      state.pageNum = 1;
    },
    setUseBackend: (state, action: PayloadAction<boolean>) => {
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
    includeNullMetadata: query?.includeNullMetadata ?? true,
    selectedTypes: [],
    useBackend: query?.useBackend ?? false,
    disableTextWrap: query?.disableTextWrap ?? false,
    showAdditionalSettings: false,
    labelSearchQuery: '',
    labelNames: [],
    labelValues: {},
    // @todo refactor to use QueryBuilderLabelFilter
    selectedLabelValues: query?.labels ?? [],
    metricsStale: false,
  };
}

type LabelName = string;
type LabelValue = string;

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
  /** List of label names */
  labelNames: string[];
  /** Record of label values, index is the label name */
  labelValues: Record<LabelName, LabelValue[]>;
  /** Map of selected label names to values */
  selectedLabelValues: QueryBuilderLabelFilter[];
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
  /** Label search text */
  labelSearchQuery: string;
  /** mark when the metrics are stale */
  metricsStale: boolean;
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

export type MetricsLabelsData = {
  isLoading: boolean;
  labelNames: string[];
};

export type MetricsLabelValuesData = {
  isLoading: boolean;
  labelName: string;
  labelValues: string[];
};

// for updating the settings in the PromQuery model
export function getSettings(visQuery: PromVisualQuery): MetricsModalSettings {
  return {
    useBackend: visQuery?.useBackend ?? false,
    disableTextWrap: visQuery?.disableTextWrap ?? false,
    fullMetaSearch: visQuery?.fullMetaSearch ?? false,
    includeNullMetadata: visQuery.includeNullMetadata ?? false,
  };
}

export type MetricsModalSettings = {
  useBackend?: boolean;
  disableTextWrap?: boolean;
  fullMetaSearch?: boolean;
  includeNullMetadata?: boolean;
};
