import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sortQueries } from 'app/core/history/richHistoryLocalStorageUtils';
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

    // Showing starred only: a single unbounded starred fetch is enough.
    if (showStarredOnly) {
      return getRichHistory({ search: debouncedSearch, sortOrder, datasourceFilters, starred: true });
    }

    // Showing "All": the remote backend time-bounds non-starred queries and only
    // drops the time bound for starred-only requests, so starred queries older than
    // the retention period never come back in the in-range result. Fetch the
    // in-range queries and all starred queries, then merge so starred queries are
    // always shown regardless of age (matching local storage behaviour).
    const [inRange, starred] = await Promise.all([
      getRichHistory({
        search: debouncedSearch,
        sortOrder,
        datasourceFilters,
        starred: false,
        from: 0,
        to: retentionPeriod,
      }),
      // The starred fetch only augments the in-range results, so a failure here must
      // not blank the whole list — fall back to no extra starred queries.
      getRichHistory({ search: debouncedSearch, sortOrder, datasourceFilters, starred: true }).catch(() => ({
        richHistory: [],
      })),
    ]);

    const byId = new Map<string, RichHistoryQuery>();
    for (const query of [...inRange.richHistory, ...starred.richHistory]) {
      byId.set(query.id, query);
    }
    const merged = sortQueries(Array.from(byId.values()), sortOrder);
    return { richHistory: merged, total: merged.length };
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
