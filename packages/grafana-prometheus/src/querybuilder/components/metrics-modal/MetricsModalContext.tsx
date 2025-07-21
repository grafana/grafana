import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';

import { PROMETHEUS_QUERY_BUILDER_MAX_RESULTS } from '../../../constants';
import { PrometheusLanguageProviderInterface } from '../../../language_provider';

import { generateMetricData } from './state/helpers';
import { HaystackDictionary, MetricData, MetricsData } from './types';

export const DEFAULT_RESULTS_PER_PAGE = 100;
export const MAXIMUM_RESULTS_PER_PAGE = 1000;

type Settings = {
  useBackend: boolean;
  includeNullMetadata: boolean;
  disableTextWrap: boolean;
  hasMetadata: boolean;
  fullMetaSearch: boolean;
};

type Pagination = {
  pageNum: number;
  resultsPerPage: number;
};

type TextSearch = {
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
  /** The text query used to match metrics */
  fuzzySearchQuery: string;
};

type MetricsModalContextValue = {
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  metricsData: MetricData[];
  settings: Settings;
  overrideSettings: (settings: Partial<Settings>) => void;
  pagination: Pagination;
  setPagination: (val: Pagination) => void;
  selectedTypes: Array<SelectableValue<string>>;
  setSelectedTypes: (val: Array<SelectableValue<string>>) => void;
  textSearch: TextSearch;
  setTextSearch: (val: TextSearch) => void;
};

const MetricsModalContext = createContext<MetricsModalContextValue | undefined>(undefined);

type MetricsModalContextProviderProps = {
  languageProvider: PrometheusLanguageProviderInterface;
};

export const MetricsModalContextProvider: FC<PropsWithChildren<MetricsModalContextProviderProps>> = ({
  children,
  languageProvider,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [metricsData, setMetricsData] = useState<MetricsData>([]);
  const [pagination, setPagination] = useState<Pagination>({
    pageNum: 1,
    resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
  });
  const [selectedTypes, setSelectedTypes] = useState<Array<SelectableValue<string>>>([]);
  const [textSearch, setTextSearch] = useState<TextSearch>({
    fuzzySearchQuery: '',
    metaHaystackDictionary: {},
    metaHaystackMatches: [],
    metaHaystackOrder: [],
    nameHaystackDictionary: {},
    nameHaystackMatches: [],
    nameHaystackOrder: [],
  });
  const [settings, setSettings] = useState<Settings>({
    disableTextWrap: false,
    hasMetadata: true,
    includeNullMetadata: true,
    useBackend: false,
    fullMetaSearch: false,
  });

  const overrideSettings = useCallback(
    (override: Partial<Settings>) => {
      setSettings({
        ...settings,
        ...override,
      });
    },
    [settings]
  );

  const fetchMetadata = useCallback(async () => {
    setIsLoading(true);
    const metadata = await languageProvider.queryMetricsMetadata(PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);
    if (Object.keys(metadata).length === 0) {
      overrideSettings({ hasMetadata: false });
      return;
    }

    setMetricsData(Object.keys(metadata).map((m) => generateMetricData(m, languageProvider)));
    setIsLoading(false);
  }, [languageProvider, overrideSettings]);

  useEffect(() => {
    fetchMetadata();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MetricsModalContext.Provider
      value={{
        settings,
        overrideSettings,
        isLoading,
        setIsLoading,
        metricsData,
        pagination,
        setPagination,
        selectedTypes,
        setSelectedTypes,
        textSearch,
        setTextSearch,
      }}
    >
      {children}
    </MetricsModalContext.Provider>
  );
};

export function useMetricsModal() {
  const context = useContext(MetricsModalContext);
  if (context === undefined) {
    throw new Error('useMetricsModal must be used within a MetricsModalContextProvider');
  }
  return context;
}
