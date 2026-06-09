import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getRichHistory, getRichHistorySettings, updateStarredInRichHistory } from 'app/core/utils/richHistory';
import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { getStoredFilterDefaults, storeFilterDefaults } from './filterDefaults';

export type RecentQueriesFilterState = {
  searchQuery: string;
  datasourceFilters: string[];
  sortingOption: SelectableValue<SortOrder>;
  showStarredOnly: boolean;
  rememberFilters: boolean;
};

export type UseRecentQueriesDataReturn = {
  queries: RichHistoryQuery[];
  isLoading: boolean;
  isInitialLoad: boolean;
  error: unknown;
  filters: RecentQueriesFilterState;
  setFilters: (update: Partial<RecentQueriesFilterState>) => void;
  starQuery: (id: string, starred: boolean) => Promise<void>;
};

function defaultSortingOption(): SelectableValue<SortOrder> {
  return {
    value: SortOrder.Descending,
    label: t('recent-queries.sort.newest', 'Newest first'),
  };
}

export function useRecentQueriesData(): UseRecentQueriesDataReturn {
  const storedDefaults = useMemo(() => getStoredFilterDefaults<RecentQueriesFilterState>('recent'), []);

  const [filters, setFiltersState] = useState<RecentQueriesFilterState>(() => {
    const base: RecentQueriesFilterState = {
      searchQuery: '',
      datasourceFilters: [],
      sortingOption: defaultSortingOption(),
      showStarredOnly: false,
      rememberFilters: false,
    };
    if (storedDefaults.rememberFilters === true) {
      return { ...base, ...storedDefaults };
    }
    return base;
  });

  const [displayedQueries, setDisplayedQueries] = useState<RichHistoryQuery[]>([]);
  const hasCompletedInitialFetch = useRef(false);

  const setFilters = useCallback((update: Partial<RecentQueriesFilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...update }));
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
  const [debouncedSearch, setDebouncedSearch] = useState(filters.searchQuery);
  useDebounce(() => setDebouncedSearch(filters.searchQuery), 300, [filters.searchQuery]);
  const sortOrder = filters.sortingOption.value ?? SortOrder.Descending;
  const showStarredOnly = filters.showStarredOnly;
  const { datasourceFilters } = filters;

  const {
    value: fetchResult,
    loading: isFetching,
    error,
  } = useAsync(async () => {
    if (retentionPeriod === undefined) {
      return undefined;
    }
    return getRichHistory({
      search: debouncedSearch,
      sortOrder,
      datasourceFilters,
      starred: showStarredOnly,
      from: 0,
      to: retentionPeriod,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- datasourceFiltersKey is a stable string derived from datasourceFilters
  }, [debouncedSearch, sortOrder, datasourceFiltersKey, showStarredOnly, retentionPeriod]);

  useEffect(() => {
    if (!fetchResult) {
      return;
    }
    hasCompletedInitialFetch.current = true;
    setDisplayedQueries(fetchResult.richHistory);
  }, [fetchResult]);

  const starQuery = useCallback(async (id: string, starred: boolean) => {
    const result = await updateStarredInRichHistory(id, starred);
    if (result !== undefined) {
      setDisplayedQueries((prev) => prev.map((q) => (q.id === id ? { ...q, starred } : q)));
    }
  }, []);

  const isLoading = isFetching || settings === undefined;
  const isInitialLoad = !hasCompletedInitialFetch.current && isLoading;

  return {
    queries: displayedQueries,
    isLoading,
    isInitialLoad,
    error,
    filters,
    setFilters,
    starQuery,
  };
}
