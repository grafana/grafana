import { SelectableValue } from '@grafana/data';

import { HaystackDictionary, MetricsData } from '../types';

// An interface for the Metric Encyclopedia state
export interface MetricEncyclopediaState {
  isLoading: boolean;
  metrics: MetricsData;
  hasMetadata: boolean;
  metaHaystackDictionary: HaystackDictionary;
  nameHaystackDictionary: HaystackDictionary;
  totalMetricCount: number;
  filteredMetricCount: number | null;
  resultsPerPage: number;
  pageNum: number;
  fuzzySearchQuery: string;
  nameHaystackOrder: string[];
  metaHaystackOrder: string[];
  fullMetaSearch: boolean;
  excludeNullMetadata: boolean;
  selectedTypes: Array<SelectableValue<string>>;
  letterSearch: string;
  useBackend: boolean;
  disableTextWrap: boolean;
}

// type for the useEffect load metadata
export type MetricEncyclopediaMetadata = {
  isLoading: boolean;
  metrics: MetricsData;
  hasMetadata: boolean;
  metaHaystackDictionary: HaystackDictionary;
  nameHaystackDictionary: HaystackDictionary;
  totalMetricCount: number;
  filteredMetricCount: number | null;
};

// An interface for Metric Encyclopedia actions
// with a discriminated union type
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
  | { type: 'setNameHaystackOrder'; payload: string[] }
  | { type: 'setMetaHaystackOrder'; payload: string[] }
  | { type: 'setFullMetaSearch'; payload: boolean }
  | { type: 'setExcludeNullMetadata'; payload: boolean }
  | { type: 'setSelectedTypes'; payload: Array<SelectableValue<string>> }
  | { type: 'setLetterSearch'; payload: string }
  | { type: 'setUseBackend'; payload: boolean }
  | { type: 'setDisableTextWrap'; payload: null };
