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
import { fuzzySearch } from './uFuzzy';

export const DEFAULT_RESULTS_PER_PAGE = 25;

type Pagination = {
  pageNum: number;
  resultsPerPage: number;
  totalPageNum: number;
};

type MetricsModalContextValue = {
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  filteredMetricsData: MetricData[];
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
    totalPageNum: 1,
    resultsPerPage: DEFAULT_RESULTS_PER_PAGE,
  });
  const [selectedTypes, setSelectedTypes] = useState<Array<SelectableValue<string>>>([]);
  const [searchedText, setSearchedText] = useState('');

  const filteredMetricsData = useMemo(() => {
    if (selectedTypes.length === 0) {
      return metricsData;
    }

    // Filter metrics based on selected types
    return metricsData.filter((metric: MetricData) => {
      return selectedTypes.some((selectedType) => {
        // Handle metrics with defined types
        if (metric.type && selectedType.value) {
          return metric.type.includes(selectedType.value);
        }

        // Handle metrics without type when "no type" is selected
        if (!metric.type && selectedType.value === 'no type') {
          return true;
        }

        return false;
      });
    });
  }, [metricsData, selectedTypes]);

  useEffect(() => {
    const totalPageNum =
      filteredMetricsData.length === 0 ? 1 : Math.ceil(filteredMetricsData.length / pagination.resultsPerPage);
    const pageNum = pagination.pageNum > totalPageNum ? 1 : pagination.pageNum;
    
    setPagination((prevPagination) => ({
      ...prevPagination,
      totalPageNum,
      pageNum,
    }));
  }, [filteredMetricsData.length, pagination.resultsPerPage, pagination.pageNum]);

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
          const match = `{__name__=~"(?i).*${queryString}"${filterArray ? filterArray.join('') : ''}}`;

          const results = await languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match);

          // Check if this is still the most recent search
          if (searchId !== latestSearchIdRef.current) {
            return; // Ignore outdated results
          }

          const [fuzzyOrderedMetrics] = fuzzySearch(results, queryString);
          const resultsOptions: MetricsData = fuzzyOrderedMetrics.map((m) => generateMetricData(m, languageProvider));

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
        filteredMetricsData,
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
