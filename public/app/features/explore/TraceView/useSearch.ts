import { cloneDeep, merge } from 'lodash';
import { useEffect, useMemo, useCallback, useState } from 'react';

import { InterpolateFunction, TraceSearchProps } from '@grafana/data';
import { useDispatch, useSelector } from 'app/types/store';

import { DEFAULT_SPAN_FILTERS, randomId } from '../state/constants';
import { changePanelState } from '../state/explorePane';

import { TraceSpan } from './components/types/trace';
import { filterSpans } from './components/utils/filter-spans';

/**
 * Controls the state of search input that highlights spans if they match the search string.
 * Uses global state for Explore (when exploreId is provided) or local state for panels (when no exploreId).
 * @param exploreId - The explore pane ID (optional, for global state management)
 * @param spans - The trace spans to filter
 * @param initialFilters - Initial filters to set
 */
export function useSearch(exploreId?: string, spans?: TraceSpan[], initialFilters?: TraceSearchProps) {
  const dispatch = useDispatch();

  // Global state logic (for Explore)
  const panelState = useSelector((state) => state.explore.panes[exploreId ?? '']?.panelsState.trace);
  const { spanFilters: globalFilters } = panelState || {};

  // Local state logic (for TracesPanel and other non-Explore usage)
  const [localSearch, setLocalSearch] = useState<TraceSearchProps>(() => {
    const merged = merge(cloneDeep(DEFAULT_SPAN_FILTERS), initialFilters ?? {});
    // Ensure tags is always an array
    if (!merged.tags || !Array.isArray(merged.tags)) {
      merged.tags = [{ id: randomId(), operator: '=' }];
    }
    return merged;
  });

  // Determine which state to use based on exploreId presence
  const search = exploreId
    ? globalFilters || merge(cloneDeep(DEFAULT_SPAN_FILTERS), initialFilters ?? {})
    : localSearch;

  // Ensure tags is always an array for safety
  if (search && (!search.tags || !Array.isArray(search.tags))) {
    search.tags = [{ id: randomId(), operator: '=' }];
  }

  // Global state initialization (only when exploreId exists)
  useEffect(() => {
    if (exploreId && !globalFilters) {
      const mergedFilters = merge(cloneDeep(DEFAULT_SPAN_FILTERS), initialFilters ?? {});
      // Ensure tags is always an array
      if (!mergedFilters.tags || !Array.isArray(mergedFilters.tags)) {
        mergedFilters.tags = [{ id: randomId(), operator: '=' }];
      }

      dispatch(changePanelState(exploreId, 'trace', { ...panelState, spanFilters: mergedFilters }));
    }
  }, [exploreId, initialFilters, globalFilters, dispatch, panelState]);

  // Local state updates (only when no exploreId)
  useEffect(() => {
    if (!exploreId && initialFilters) {
      setLocalSearch((prev) => {
        const merged = merge(cloneDeep(prev), initialFilters);
        // Ensure tags is always an array
        if (!merged.tags || !Array.isArray(merged.tags)) {
          merged.tags = [{ id: randomId(), operator: '=' }];
        }
        return merged;
      });
    }
  }, [exploreId, initialFilters]);

  // Function to update span filters (global or local based on exploreId)
  const setSearch = useCallback(
    (newSearch: TraceSearchProps) => {
      if (exploreId) {
        dispatch(changePanelState(exploreId, 'trace', { ...panelState, spanFilters: newSearch }));
      } else {
        setLocalSearch(newSearch);
      }
    },
    [exploreId, dispatch, panelState]
  );

  const spanFilterMatches: Set<string> | undefined = useMemo(() => {
    return spans && filterSpans(search, spans);
  }, [search, spans]);

  return { search, setSearch, spanFilterMatches };
}

export function replaceSearchVariables(replaceVariables: InterpolateFunction, search?: TraceSearchProps) {
  if (!search) {
    return search;
  }

  const newSearch = { ...search };

  // Ensure tags is always an array
  if (!newSearch.tags || !Array.isArray(newSearch.tags)) {
    newSearch.tags = [{ id: randomId(), operator: '=' }];
  }

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
