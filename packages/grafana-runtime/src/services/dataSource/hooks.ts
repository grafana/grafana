import { useCallback, useEffect, useState } from 'react';
import { useAsync, useAsyncFn } from 'react-use';

import { type DataSourceApi, type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';

import { type GetDataSourceListFilters } from '../dataSourceSrv';

import { getDataSource } from './dataSource';
import { getDataSourceSettings, getDataSourceSettingsList } from './settings';

/**
 * @public
 */
export interface UseDataSourceSettingsResult {
  isLoading: boolean;
  error?: Error;
  settings?: DataSourceInstanceSettings;
}

/**
 * @public
 */
export interface UseDataSourceSettingsListResult {
  isLoading: boolean;
  error?: Error;
  /** Flattened items across all pages fetched so far. */
  items: DataSourceInstanceSettings[];
  hasMore: boolean;
  /** Fetch the next page and append to items. */
  fetchMore: () => void;
}

/**
 * @public
 */
export interface UseDataSourceResult {
  isLoading: boolean;
  error?: Error;
  dataSource?: DataSourceApi;
}

function stableKey(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/**
 * React hook wrapping {@link getDataSourceSettings}. Re-fetches when `ref`
 * changes (compared by value, so inline objects are safe).
 *
 * @public
 */
export function useDataSourceSettings(ref?: DataSourceRef | string | null): UseDataSourceSettingsResult {
  const refKey = stableKey(ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getDataSourceSettings(ref), [refKey]);
  return { isLoading: loading, error, settings: value };
}

/**
 * React hook wrapping {@link getDataSourceSettingsList}. Items are flattened
 * across pages; call `fetchMore` to load additional pages. Items reset when
 * `filters` changes (compared by value, so inline objects are safe).
 *
 * @public
 */
export function useDataSourceSettingsList(filters?: GetDataSourceListFilters): UseDataSourceSettingsListResult {
  const filtersKey = stableKey(filters);

  const [items, setItems] = useState<DataSourceInstanceSettings[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const [fetchState, fetchPage] = useAsyncFn(
    (nextCursor?: string) => getDataSourceSettingsList({ filters, cursor: nextCursor }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey],
    { loading: true }
  );

  useEffect(() => {
    if (!fetchState.value) {
      return;
    }
    const page = fetchState.value;
    setItems((prev) => prev.concat(page.items));
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
  }, [fetchState.value]);

  useEffect(() => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    fetchPage();
  }, [fetchPage]);

  const fetchMore = useCallback(() => {
    if (!hasMore || fetchState.loading) {
      return;
    }
    fetchPage(cursor);
  }, [fetchPage, cursor, hasMore, fetchState.loading]);

  return { isLoading: fetchState.loading, error: fetchState.error, items, hasMore, fetchMore };
}

/**
 * React hook wrapping {@link getDataSource}. Re-fetches when `ref`
 * changes (compared by value, so inline objects are safe).
 *
 * @public
 */
export function useDataSource(ref?: DataSourceRef | string | null): UseDataSourceResult {
  const refKey = stableKey(ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getDataSource(ref), [refKey]);
  return { isLoading: loading, error, dataSource: value };
}
