import { useEffect } from 'react';

import { DataSourceLoadState } from './useDataSourceLoadingStates';

/**
 * Reports datasource loading state to parent with automatic cleanup.
 * Replaces dual useEffect pattern with single hook call.
 *
 * @param uid - Unique identifier for the datasource
 * @param state - Current loading state
 * @param onLoadingStateChange - Optional callback to parent
 */
export function useDataSourceLoadingReporter(
  uid: string,
  state: DataSourceLoadState,
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void
) {
  const { isLoading, rulesCount, error } = state;

  // Report state changes
  useEffect(() => {
    if (onLoadingStateChange) {
      onLoadingStateChange(uid, { isLoading, rulesCount, error });
    }
  }, [uid, isLoading, rulesCount, error, onLoadingStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (onLoadingStateChange) {
        onLoadingStateChange(uid, {
          isLoading: false,
          rulesCount: 0,
          error: undefined,
        });
      }
    };
  }, [uid, onLoadingStateChange]);
}
