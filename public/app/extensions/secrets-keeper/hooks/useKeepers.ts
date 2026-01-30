// Mock hook for fetching keepers list
// TODO: Replace with real RTK Query hook when API is available
import { useMemo } from 'react';
import * as React from 'react';

import { MOCK_KEEPER_LIST } from '../mocks/mockData';
import { KeeperListItem } from '../types';

export interface UseKeepersResult {
  keepers: KeeperListItem[];
  isLoading: boolean;
  error: Error | null;
  activeKeeper: KeeperListItem | undefined;
}

/**
 * Mock hook that returns hardcoded keeper list
 *
 * TODO: Replace with:
 * ```
 * import { useListKeeperQuery } from 'app/api/clients/secret/v1beta1';
 *
 * export function useKeepers() {
 *   const { data, isLoading, error } = useListKeeperQuery({});
 *
 *   const keepers = useMemo(() => {
 *     return data?.items?.map(keeperToListItem).sort(...) ?? [];
 *   }, [data]);
 *
 *   const activeKeeper = keepers.find(k => k.isActive);
 *
 *   return { keepers, isLoading, error, activeKeeper };
 * }
 * ```
 */
export function useKeepers(): UseKeepersResult {
  // Simulate loading delay on first render
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const keepers = useMemo(() => {
    // Sort by name
    // eslint-disable-next-line no-restricted-syntax
    return [...MOCK_KEEPER_LIST].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const activeKeeper = useMemo(() => {
    return keepers.find((k) => k.isActive);
  }, [keepers]);

  return {
    keepers,
    isLoading,
    error: null,
    activeKeeper,
  };
}
