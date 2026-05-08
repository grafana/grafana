import { useCallback, useEffect, useState } from 'react';
import { useAsync, useAsyncFn } from 'react-use';

import { type DataSourceApi, type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';

import { type GetDataSourceListFilters } from '../dataSourceSrv';

import { getDataSourceSettings, getDataSourceSettingsList } from './instanceSettings';
import { getDataSource } from './plugin';

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

/**
 * React hook wrapping {@link getDataSourceSettings}. Re-fetches when `ref`
 * changes.
 *
 * @public
 */
export function useDataSourceSettings(ref?: DataSourceRef | string | null): UseDataSourceSettingsResult {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getDataSourceSettings(ref), [ref]);
  return { isLoading: loading, error, settings: value };
}

/**
 * React hook wrapping {@link getDataSourceSettingsList}. Items are flattened
 * across pages; call `fetchMore` to load additional pages. Items reset when
 * `filters` changes (by reference — pass a stable object to avoid extra
 * fetches).
 *
 * @public
 */
export function useDataSourceSettingsList(filters?: GetDataSourceListFilters): UseDataSourceSettingsListResult {
  const [items, setItems] = useState<DataSourceInstanceSettings[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const [fetchState, fetchPage] = useAsyncFn(
    (nextCursor?: string) => getDataSourceSettingsList({ filters, cursor: nextCursor }),
    [filters], // object equality — pass a stable ref to avoid extra fetches
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
 * changes.
 *
 * @public
 */
export function useDataSource(ref?: DataSourceRef | string | null): UseDataSourceResult {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getDataSource(ref), [ref]);
  return { isLoading: loading, error, dataSource: value };
}
