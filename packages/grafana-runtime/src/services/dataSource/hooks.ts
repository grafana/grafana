import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsync } from 'react-use';

import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
} from '@grafana/data';

import { type GetDataSourceListFilters } from '../dataSourceSrv';

import { type DataSourceInstanceSettingsPage, getInstanceSettings, getInstanceSettingsList } from './instanceSettings';
import { getDataSourcePlugin } from './plugin';

/**
 * @public
 */
export interface UseInstanceSettingsResult {
  isLoading: boolean;
  error?: Error;
  data?: DataSourceInstanceSettings;
}

/**
 * @public
 */
export interface UseInstanceSettingsListResult {
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
export interface UseDataSourcePluginResult {
  isLoading: boolean;
  error?: Error;
  data?: DataSourceApi;
}

/**
 * React hook wrapping {@link getInstanceSettings}. Re-fetches when `ref`
 * changes.
 *
 * @public
 */
export function useInstanceSettings(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): UseInstanceSettingsResult {
  const refKey = useRefKey(ref);
  // scopedVars is intentionally not a dep — callers typically pass an unstable
  // reference and interpolation has already happened before the hook runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getInstanceSettings(ref, scopedVars), [refKey]);
  return { isLoading: loading, error, data: value };
}

/**
 * React hook wrapping {@link getInstanceSettingsList}. Items are flattened
 * across pages; call `fetchMore` to load additional pages. Items reset when
 * `filters` change.
 *
 * @public
 */
export function useInstanceSettingsList(filters?: GetDataSourceListFilters): UseInstanceSettingsListResult {
  const [items, setItems] = useState<DataSourceInstanceSettings[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const filtersKey = useFiltersKey(filters);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const fetchPage = useCallback(
    (nextCursor: string | undefined, reset: boolean) => {
      const token = { cancelled: false };
      cancelRef.current.cancelled = true;
      cancelRef.current = token;

      setIsLoading(true);
      getInstanceSettingsList({ filters, cursor: nextCursor })
        .then((page: DataSourceInstanceSettingsPage) => {
          if (token.cancelled) {
            return;
          }
          setItems((prev) => (reset ? page.items : prev.concat(page.items)));
          setCursor(page.nextCursor);
          setHasMore(page.hasMore);
          setError(undefined);
          setIsLoading(false);
        })
        .catch((err) => {
          if (token.cancelled) {
            return;
          }
          setError(toError(err));
          setIsLoading(false);
        });
    },
    // `filters` is captured via filtersKey — avoid triggering on unstable
    // reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey]
  );

  useEffect(() => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    fetchPage(undefined, true);
    return () => {
      cancelRef.current.cancelled = true;
    };
  }, [fetchPage]);

  const fetchMore = useCallback(() => {
    if (!hasMore || isLoading) {
      return;
    }
    fetchPage(cursor, false);
  }, [fetchPage, cursor, hasMore, isLoading]);

  return { isLoading, error, items, hasMore, fetchMore };
}

/**
 * React hook wrapping {@link getDataSourcePlugin}. Re-fetches when `ref`
 * changes.
 *
 * @public
 */
export function useDataSourcePlugin(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): UseDataSourcePluginResult {
  const refKey = useRefKey(ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getDataSourcePlugin(ref, scopedVars), [refKey]);
  return { isLoading: loading, error, data: value };
}

function useRefKey(ref: DataSourceRef | string | null | undefined): string {
  return useMemo(() => {
    if (ref == null) {
      return '__default__';
    }
    if (typeof ref === 'string') {
      return `s:${ref}`;
    }
    return `r:${ref.uid ?? ''}|${ref.type ?? ''}`;
  }, [ref]);
}

function useFiltersKey(filters: GetDataSourceListFilters | undefined): string {
  return useMemo(() => {
    if (!filters) {
      return '';
    }
    // `filter` is a function and can't be serialized — include its identity.
    const { filter, ...rest } = filters;
    try {
      return JSON.stringify(rest) + (filter ? '|fn' : '');
    } catch {
      return Math.random().toString();
    }
  }, [filters]);
}

function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === 'string') {
    return new Error(err);
  }
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error('Unknown error');
  }
}
