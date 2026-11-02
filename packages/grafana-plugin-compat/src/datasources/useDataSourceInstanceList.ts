import { useEffect, useMemo, useState } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { useDataSourceInstanceList as stableUseDataSourceInstanceList } from '@grafana/runtime';
import { useDataSourceInstanceList as unstableUseDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getDataSourceInstanceList } from './getDataSourceInstanceList';
import { type GetDataSourceInstanceListFilters } from './types';

/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export interface UseDataSourceInstanceListResult {
  isLoading: boolean;
  error?: Error;
  items: DataSourceInstanceListItem[];
}

/**
 * Uses the host hook when available. The fallback re-fetches only when `filters` changes by value or the
 * `filter` function reference changes, not on data source cache changes. Picked once at load so the hook
 * order stays stable.
 */
export const useDataSourceInstanceList: (
  filters?: GetDataSourceInstanceListFilters
) => UseDataSourceInstanceListResult =
  typeof stableUseDataSourceInstanceList === 'function'
    ? stableUseDataSourceInstanceList
    : typeof unstableUseDataSourceInstanceList === 'function'
      ? unstableUseDataSourceInstanceList
      : useBackwardsCompatibleDataSourceInstanceList;

function useBackwardsCompatibleDataSourceInstanceList(
  filters?: GetDataSourceInstanceListFilters
): UseDataSourceInstanceListResult {
  // One empty array per hook instance, like the host hook, so callers can rely on its identity.
  const emptyItems = useMemo<DataSourceInstanceListItem[]>(() => [], []);
  const [result, setResult] = useState<UseDataSourceInstanceListResult>({ isLoading: true, items: emptyItems });
  const { filter, ...rest } = filters ?? {};
  // Same key as the host hook, so equal inline filters don't refetch. The `filter` function is compared by reference.
  const filtersKey = JSON.stringify(rest);

  useEffect(() => {
    let isCurrent = true;
    setResult((previous) => ({ ...previous, isLoading: true }));

    getDataSourceInstanceList(filters).then(
      (items) => isCurrent && setResult({ isLoading: false, items }),
      (error: Error) => isCurrent && setResult({ isLoading: false, error, items: emptyItems })
    );

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, filter]);

  return result;
}
