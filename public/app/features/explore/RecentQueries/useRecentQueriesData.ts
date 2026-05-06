import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsync } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getRichHistory, getRichHistorySettings, updateStarredInRichHistory } from 'app/core/utils/richHistory';
import { type RichHistorySettings, SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { getStoredFilterDefaults, storeFilterDefaults } from './filterDefaults';

export type RecentQueriesFilterState = {
  searchQuery: string;
  datasourceFilters: string[];
  sortingOption: SelectableValue<SortOrder>;
  rememberFilters: boolean;
};

export type UseRecentQueriesDataReturn = {
  queries: RichHistoryQuery[];
  totalQueries: number;
  isLoading: boolean;
  isInitialLoad: boolean;
  error: unknown;
  settings: RichHistorySettings | undefined;
  filters: RecentQueriesFilterState;
  setFilters: (update: Partial<RecentQueriesFilterState>) => void;
  loadMore: () => void;
  starQuery: (id: string, starred: boolean) => Promise<void>;
};

function defaultSortingOption(): SelectableValue<SortOrder> {
  return {
    value: SortOrder.Descending,
    label: t('recent-queries.sort.newest', 'Newest first'),
  };
}

export function useRecentQueriesData(activeDatasources: string[] = []): UseRecentQueriesDataReturn {
  const storedDefaults = useMemo(() => getStoredFilterDefaults<RecentQueriesFilterState>('recent'), []);

  const [filters, setFiltersState] = useState<RecentQueriesFilterState>(() => {
    const base: RecentQueriesFilterState = {
      searchQuery: '',
      datasourceFilters: activeDatasources,
      sortingOption: defaultSortingOption(),
      rememberFilters: false,
    };
    if (storedDefaults.rememberFilters === true) {
      return { ...base, ...storedDefaults };
    }
    return base;
  });

  const [page, setPage] = useState(1);
  const [accumulatedQueries, setAccumulatedQueries] = useState<RichHistoryQuery[]>([]);
  const [totalQueries, setTotalQueries] = useState(0);
  const hasCompletedInitialFetch = useRef(false);

  const setFilters = useCallback((update: Partial<RecentQueriesFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...update }));
    setPage(1);
  }, []);

  const loadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const { value: settings } = useAsync(() => getRichHistorySettings(), []);

  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  });

  useEffect(() => {
    return () => {
      if (filtersRef.current.rememberFilters) {
        storeFilterDefaults('recent', filtersRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevRememberFiltersRef = useRef(false);
  useEffect(() => {
    if (!filters.rememberFilters && prevRememberFiltersRef.current) {
      storeFilterDefaults('recent', {});
    }
    prevRememberFiltersRef.current = filters.rememberFilters;
  }, [filters.rememberFilters]);

  const datasourceFiltersKey = useMemo(
    () => filters.datasourceFilters.slice().sort().join(','),
    [filters.datasourceFilters]
  );

  const retentionPeriod = settings?.retentionPeriod;
  const search = filters.searchQuery;
  const sortOrder = filters.sortingOption.value ?? SortOrder.Descending;

  const fetchPageRef = useRef(page);

  const {
    value: fetchResult,
    loading: isFetching,
    error,
  } = useAsync(async () => {
    if (retentionPeriod === undefined) {
      return undefined;
    }
    fetchPageRef.current = page;
    return getRichHistory({
      search,
      sortOrder,
      datasourceFilters: filters.datasourceFilters,
      starred: false,
      from: 0,
      to: retentionPeriod,
      page,
    });
  }, [search, sortOrder, datasourceFiltersKey, retentionPeriod, page]);

  useEffect(() => {
    if (!fetchResult) {
      return;
    }
    hasCompletedInitialFetch.current = true;
    const fetchedPage = fetchPageRef.current;
    if (fetchedPage === 1) {
      setAccumulatedQueries(fetchResult.richHistory);
    } else {
      setAccumulatedQueries((prev) => [...prev, ...fetchResult.richHistory]);
    }
    setTotalQueries(fetchResult.total ?? 0);
  }, [fetchResult]);

  const starQuery = useCallback(async (id: string, starred: boolean) => {
    const result = await updateStarredInRichHistory(id, starred);
    if (result !== undefined) {
      setAccumulatedQueries((prev) => prev.map((q) => (q.id === id ? { ...q, starred } : q)));
    }
  }, []);

  const isLoading = isFetching || settings === undefined;
  const isInitialLoad = !hasCompletedInitialFetch.current && isLoading;

  return {
    queries: accumulatedQueries,
    totalQueries,
    isLoading,
    isInitialLoad,
    error,
    settings,
    filters,
    setFilters,
    loadMore,
    starQuery,
  };
}
