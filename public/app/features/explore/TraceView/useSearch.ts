import { cloneDeep, merge } from 'lodash';
import { useEffect, useMemo, useCallback, useState } from 'react';

import { InterpolateFunction, SearchProps } from '@grafana/data';
import { useDispatch, useSelector } from 'app/types/store';

import { DEFAULT_SPAN_FILTERS } from '../state/constants';
import { setSpanFilters } from '../state/main';
import { getSpanFiltersSelector } from '../state/selectors';

import { TraceSpan } from './components/types/trace';
import { filterSpans } from './components/utils/filter-spans';

/**
 * Controls the state of search input that highlights spans if they match the search string.
 * Uses global state for Explore (when exploreId is provided) or local state for panels (when no exploreId).
 * @param exploreId - The explore pane ID (optional, for global state management)
 * @param spans - The trace spans to filter
 * @param initialFilters - Initial filters to set
 */
export function useSearch(exploreId?: string, spans?: TraceSpan[], initialFilters?: SearchProps) {
  const dispatch = useDispatch();

  // Global state logic (for Explore)
  const globalFilters = useSelector(getSpanFiltersSelector(exploreId ?? ''));

  // Local state logic (for TracesPanel and other non-Explore usage)
  const [localSearch, setLocalSearch] = useState<SearchProps>(
    merge(cloneDeep(DEFAULT_SPAN_FILTERS), initialFilters ?? {})
  );

  // Determine which state to use based on exploreId presence
  const search = exploreId
    ? globalFilters || merge(cloneDeep(DEFAULT_SPAN_FILTERS), initialFilters ?? {})
    : localSearch;

  // Global state initialization (only when exploreId exists)
  useEffect(() => {
    if (exploreId && !globalFilters) {
      const mergedFilters = merge(cloneDeep(DEFAULT_SPAN_FILTERS), initialFilters ?? {});
      dispatch(setSpanFilters({ exploreId, spanFilters: mergedFilters }));
    }
  }, [exploreId, initialFilters, globalFilters, dispatch]);

  // Local state updates (only when no exploreId)
  useEffect(() => {
    if (!exploreId && initialFilters) {
      setLocalSearch((prev) => {
        return merge(cloneDeep(prev), initialFilters);
      });
    }
  }, [exploreId, initialFilters]);

  // Function to update span filters (global or local based on exploreId)
  const setSearch = useCallback(
    (newSearch: SearchProps) => {
      if (exploreId) {
        dispatch(setSpanFilters({ exploreId, spanFilters: newSearch }));
      } else {
        setLocalSearch(newSearch);
      }
    },
    [exploreId, dispatch]
  );

  const spanFilterMatches: Set<string> | undefined = useMemo(() => {
    return spans && filterSpans(search, spans);
  }, [search, spans]);

  return { search, setSearch, spanFilterMatches };
}

export function replaceSearchVariables(replaceVariables: InterpolateFunction, search?: SearchProps) {
  if (!search) {
    return search;
  }

  const newSearch = { ...search };
  if (newSearch.query) {
    newSearch.query = replaceVariables(newSearch.query);
  }
  if (newSearch.serviceNameOperator) {
    newSearch.serviceNameOperator = replaceVariables(newSearch.serviceNameOperator);
  }
  if (newSearch.serviceName) {
    newSearch.serviceName = replaceVariables(newSearch.serviceName);
  }
  if (newSearch.spanNameOperator) {
    newSearch.spanNameOperator = replaceVariables(newSearch.spanNameOperator);
  }
  if (newSearch.spanName) {
    newSearch.spanName = replaceVariables(newSearch.spanName);
  }
  if (newSearch.from) {
    newSearch.from = replaceVariables(newSearch.from);
  }
  if (newSearch.to) {
    newSearch.to = replaceVariables(newSearch.to);
  }
  if (newSearch.tags) {
    newSearch.tags = newSearch.tags.map((tag) => {
      return {
        ...tag,
        key: replaceVariables(tag.key ?? ''),
        value: replaceVariables(tag.value ?? ''),
      };
    });
  }

  return newSearch;
}
