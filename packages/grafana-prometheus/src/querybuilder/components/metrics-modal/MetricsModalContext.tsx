import debounce from 'debounce-promise';
import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SelectableValue, TimeRange } from '@grafana/data';

import { METRIC_LABEL, PROMETHEUS_QUERY_BUILDER_MAX_RESULTS } from '../../../constants';
import { PrometheusLanguageProviderInterface } from '../../../language_provider';
import { regexifyLabelValuesQueryString } from '../../parsingUtils';
import { QueryBuilderLabelFilter } from '../../shared/types';
import { formatPrometheusLabelFilters } from '../formatter';

import { generateMetricData } from './helpers';
import { MetricData, MetricsData } from './types';

export const DEFAULT_RESULTS_PER_PAGE = 25;

type Pagination = {
  pageNum: number;
  resultsPerPage: number;
};

type MetricsModalContextValue = {
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  metricsData: MetricData[];
  debouncedBackendSearch: (
    timeRange: TimeRange,
    metricText: string,
    queryLabels?: QueryBuilderLabelFilter[]
  ) => Promise<void>;
  pagination: Pagination;
  setPagination: (val: Pagination) => void;
  selectedTypes: Array<SelectableValue<string>>;
  setSelectedTypes: (val: Array<SelectableValue<string>>) => void;
  searchedText: string;
  setSearchedText: (val: string) => void;
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
  const [searchedText, setSearchedText] = useState('');

  // Track the latest search ID to handle race conditions
  const latestSearchIdRef = useRef<number>(0);

  const fetchMetadata = useCallback(async () => {
    try {
      setIsLoading(true);
      const metadata = await languageProvider.queryMetricsMetadata(PROMETHEUS_QUERY_BUILDER_MAX_RESULTS);

      if (Object.keys(metadata).length === 0) {
        setMetricsData([]);
      } else {
        const processedData = Object.keys(metadata).map((m) => generateMetricData(m, languageProvider));
        setMetricsData(processedData);
      }
    } catch (error) {
      setMetricsData([]);
    } finally {
      setIsLoading(false);
    }
  }, [languageProvider]);

  const debouncedBackendSearch = useMemo(
    () =>
      debounce(async (timeRange: TimeRange, metricText: string, queryLabels?: QueryBuilderLabelFilter[]) => {
        // Generate unique search ID to handle race conditions
        const searchId = ++latestSearchIdRef.current;

        try {
          if (metricText === '') {
            await fetchMetadata();
            return;
          }

          setIsLoading(true);

          const queryString = regexifyLabelValuesQueryString(metricText);
          const filterArray = queryLabels ? formatPrometheusLabelFilters(queryLabels) : [];
          const match = `{__name__=~".*${queryString}"${filterArray ? filterArray.join('') : ''}}`;

          const results = await languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match);

          // Check if this is still the most recent search
          if (searchId !== latestSearchIdRef.current) {
            return; // Ignore outdated results
          }

          const resultsOptions: MetricsData = results.map((m) => generateMetricData(m, languageProvider));

          setMetricsData(resultsOptions);
          setIsLoading(false);
        } catch (error) {
          // Only update state if this is still the latest search
          if (searchId === latestSearchIdRef.current) {
            console.error('Backend search failed:', error);
            setMetricsData([]); // Clear results on error
            setIsLoading(false);
          }
        }
      }, 300),
    [fetchMetadata, languageProvider]
  );

  useEffect(() => {
    fetchMetadata();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MetricsModalContext.Provider
      value={{
        isLoading,
        setIsLoading,
        metricsData,
        debouncedBackendSearch,
        pagination,
        setPagination,
        selectedTypes,
        setSelectedTypes,
        searchedText,
        setSearchedText,
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
