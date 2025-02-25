import { useEffect, useRef } from 'react';

import { useGetFrontendSettingsQuery } from '../api';

/**
 * Custom hook that wraps useGetFrontendSettingsQuery with delayed refetching
 * after deletion operations
 */
export function useFrontendSettingsWithDelay() {
  const settingsQuery = useGetFrontendSettingsQuery();
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refetchWithDelay = (delayMs = 2000) => {
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }

    refetchTimeoutRef.current = setTimeout(() => {
      settingsQuery.refetch();
      refetchTimeoutRef.current = null;
    }, delayMs);
  };

  useEffect(() => {
    return () => {
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...settingsQuery,
    refetchWithDelay,
  };
}
