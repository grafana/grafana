import { isEqual } from 'lodash';
import { useCallback, useMemo, useState } from 'react';

export interface DataSourceLoadState {
  isLoading: boolean;
  rulesCount: number;
  error?: unknown;
}

interface DerivedStates {
  loadingDataSources: string[];
  totalRulesCount: number;
  dataSourcesWithErrors: Array<{ uid: string; error: unknown }>;
  hasAnyLoading: boolean;
  hasAnyErrors: boolean;
}

/**
 * Manages loading states for multiple datasources with automatic cleanup.
 * Centralizes state management for datasource loaders in GroupedView.
 */
export function useDataSourceLoadingStates() {
  const [states, setStates] = useState<Map<string, DataSourceLoadState>>(new Map());

  // Update state function with deep comparison
  const updateState = useCallback((uid: string, newState: DataSourceLoadState) => {
    setStates((prev) => {
      const currentState = prev.get(uid);

      // Deep comparison - only update if state actually changed
      if (isEqual(currentState, newState)) {
        return prev;
      }

      const next = new Map(prev);
      next.set(uid, newState);
      return next;
    });
  }, []);

  // Derive useful values - memoized for performance
  const derived = useMemo<DerivedStates>(() => {
    const entries = Array.from(states.entries());

    const loadingDataSources = entries.filter(([_, state]) => state.isLoading).map(([uid]) => uid);

    const totalRulesCount = entries.reduce((sum, [_, state]) => sum + state.rulesCount, 0);

    const dataSourcesWithErrors = entries
      .filter(([_, state]) => state.error !== undefined)
      .map(([uid, state]) => ({ uid, error: state.error! }));

    return {
      loadingDataSources,
      totalRulesCount,
      dataSourcesWithErrors,
      hasAnyLoading: loadingDataSources.length > 0,
      hasAnyErrors: dataSourcesWithErrors.length > 0,
    };
  }, [states]);

  return {
    updateState,
    ...derived,
  };
}
