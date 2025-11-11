import { cloneDeep, merge } from 'lodash';
import { useEffect, useMemo, useCallback, useState } from 'react';

import { InterpolateFunction, SelectableValue, TraceSearchProps } from '@grafana/data';
import { useDispatch, useSelector } from 'app/types/store';

import { DEFAULT_SPAN_FILTERS, randomId } from '../state/constants';
import { changePanelState } from '../state/explorePane';

import { TraceSpan, CriticalPathSection } from './components/types/trace';
import { filterSpans } from './components/utils/filter-spans';

/**
 * Migrate old span filters to new adhoc filters approach.
 * Maps serviceName, spanName, tags, and query to adhoc filters.
 */
export function migrateToAdhocFilters(search: TraceSearchProps): TraceSearchProps {
  // If we already have adhoc filters, don't migrate
  if (search.adhocFilters && search.adhocFilters.length > 0) {
    return search;
  }

  const adhocFilters: Array<SelectableValue<string>> = [];

  // Migrate serviceName
  if (search.serviceName && search.serviceName.trim() !== '') {
    adhocFilters.push({
      key: 'serviceName',
      operator: search.serviceNameOperator || '=',
      value: search.serviceName,
    });
  }

  // Migrate spanName
  if (search.spanName && search.spanName.trim() !== '') {
    adhocFilters.push({
      key: 'spanName',
      operator: search.spanNameOperator || '=',
      value: search.spanName,
    });
  }

  // Migrate tags
  if (search.tags && search.tags.length > 0) {
    search.tags.forEach((tag) => {
      // Only migrate tags that have both key and value
      if (tag.key && tag.key.trim() !== '' && tag.value && tag.value.trim() !== '') {
        adhocFilters.push({
          key: tag.key,
          operator: tag.operator || '=',
          value: tag.value,
        });
      }
    });
  }

  // Migrate query to _textSearch_
  if (search.query && search.query.trim() !== '') {
    adhocFilters.push({
      key: '_textSearch_',
      operator: '=',
      value: search.query,
    });
  }

  // Return search with migrated adhoc filters
  return {
    ...search,
    adhocFilters,
    // Clear old filters after migration
    serviceName: undefined,
    spanName: undefined,
    tags: [{ id: randomId(), operator: '=' }],
    query: undefined,
  };
}

/**
 * Controls the state of search input that highlights spans if they match the search string.
 * Uses global state for Explore (when exploreId is provided) or local state for panels (when no exploreId).
 * @param exploreId - The explore pane ID (optional, for global state management)
 * @param spans - The trace spans to filter
 * @param initialFilters - Initial filters to set
 * @param criticalPath - The critical path sections (optional)
 */
export function useSearch(
  exploreId?: string,
  spans?: TraceSpan[],
  initialFilters?: TraceSearchProps,
  criticalPath?: CriticalPathSection[]
) {
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
    // Migrate to adhoc filters
    return migrateToAdhocFilters(merged);
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
  // Also handle migration for existing global filters
  useEffect(() => {
    if (exploreId) {
      if (!globalFilters) {
        // Initialize with migrated filters
        let mergedFilters: TraceSearchProps = merge(cloneDeep(DEFAULT_SPAN_FILTERS), initialFilters ?? {});
        // Ensure tags is always an array
        if (!mergedFilters.tags || !Array.isArray(mergedFilters.tags)) {
          mergedFilters.tags = [{ id: randomId(), operator: '=' }];
        }
        // Ensure adhocFilters is always an array
        if (!mergedFilters.adhocFilters) {
          mergedFilters.adhocFilters = [];
        }
        // Migrate to adhoc filters
        mergedFilters = migrateToAdhocFilters(mergedFilters);

        dispatch(changePanelState(exploreId, 'trace', { ...panelState, spanFilters: mergedFilters }));
      } else {
        // Check if existing filters need migration
        const needsMigration = !globalFilters.adhocFilters || globalFilters.adhocFilters.length === 0;

        const hasOldFilters =
          globalFilters.serviceName ||
          globalFilters.spanName ||
          globalFilters.query ||
          (globalFilters.tags && globalFilters.tags.some((tag) => tag.key && tag.value));

        if (needsMigration && hasOldFilters) {
          const migratedFilters = migrateToAdhocFilters(globalFilters);
          dispatch(changePanelState(exploreId, 'trace', { ...panelState, spanFilters: migratedFilters }));
        }
      }
    }
  }, [exploreId, initialFilters, globalFilters, dispatch, panelState]);

  // Local state updates (only when no exploreId)
  useEffect(() => {
    if (!exploreId && initialFilters) {
      setLocalSearch((prev) => {
        let merged = merge(cloneDeep(prev), initialFilters);
        // Ensure tags is always an array
        if (!merged.tags || !Array.isArray(merged.tags)) {
          merged.tags = [{ id: randomId(), operator: '=' }];
        }
        // Migrate to adhoc filters
        merged = migrateToAdhocFilters(merged);
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
    return spans && filterSpans(search, spans, criticalPath);
  }, [search, spans, criticalPath]);

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

  // Replace variables in adhoc filters
  if (newSearch.adhocFilters) {
    newSearch.adhocFilters = newSearch.adhocFilters.map((filter) => {
      return {
        ...filter,
        key: replaceVariables(filter.key ?? ''),
        value: replaceVariables(filter.value ?? ''),
      };
    });
  }

  // Legacy filters (kept for backward compatibility)
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
