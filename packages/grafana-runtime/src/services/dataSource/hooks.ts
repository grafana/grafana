import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { type DataSourceApi, type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';

import { type GetDataSourceListFilters } from '../dataSourceSrv';

import { getDataSourceInstance } from './dataSource';
import { getDataSourceInstanceSettings, getDataSourceInstanceSettingsList } from './settings';

/**
 * @public
 */
export interface UseDataSourceInstanceSettingsResult {
  isLoading: boolean;
  error?: Error;
  settings?: DataSourceInstanceSettings;
}

/**
 * @public
 */
export interface UseDataSourceInstanceSettingsListResult {
  isLoading: boolean;
  error?: Error;
  items: DataSourceInstanceSettings[];
}

/**
 * @public
 */
export interface UseDataSourceInstanceResult {
  isLoading: boolean;
  error?: Error;
  dataSource?: DataSourceApi;
}

function stableKey(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function filtersKey(filters: GetDataSourceListFilters | undefined): string {
  if (!filters) {
    return stableKey(null);
  }
  const { filter: _, ...rest } = filters;
  return stableKey(rest);
}

/**
 * React hook wrapping {@link getDataSourceInstanceSettings}. Re-fetches when `ref`
 * changes (compared by value, so inline objects are safe).
 *
 * Template variable strings (e.g. `$ds` or `${ds}`) are not supported — interpolate
 * them before passing the resolved uid or name to this hook.
 *
 * @public
 */
export function useDataSourceInstanceSettings(
  ref?: DataSourceRef | string | null
): UseDataSourceInstanceSettingsResult {
  const refKey = stableKey(ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getDataSourceInstanceSettings(ref), [refKey]);
  return { isLoading: loading, error, settings: value };
}

/**
 * React hook wrapping {@link getDataSourceInstanceSettingsList}. Re-fetches when
 * `filters` changes (compared by value, so inline objects are safe).
 * When `filters.filter` (a callback) is set, the hook re-fetches when the
 * function reference changes. Wrap inline filter callbacks in `useCallback`
 * to avoid unnecessary re-fetches.
 *
 * @internal
 */
export function useDataSourceInstanceSettingsList(
  filters?: GetDataSourceListFilters
): UseDataSourceInstanceSettingsListResult {
  const filterValuesKey = filtersKey(filters);

  const filterFunc = filters?.filter;
  const filterFuncKey = useMemo(() => {
    if (filterFunc) {
      return Date.now();
    }
    return null;
  }, [filterFunc]);

  const { loading, error, value } = useAsync(
    () => getDataSourceInstanceSettingsList(filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterValuesKey, filterFuncKey]
  );

  return { isLoading: loading, error, items: value ?? [] };
}

/**
 * React hook wrapping {@link getDataSourceInstance}. Re-fetches when `ref`
 * changes (compared by value, so inline objects are safe).
 *
 * Template variable strings (e.g. `$ds` or `${ds}`) are not supported — interpolate
 * them before passing the resolved uid or name to this hook.
 *
 * @public
 */
export function useDataSourceInstance(ref?: DataSourceRef | string | null): UseDataSourceInstanceResult {
  const refKey = stableKey(ref);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { loading, error, value } = useAsync(() => getDataSourceInstance(ref), [refKey]);
  return { isLoading: loading, error, dataSource: value };
}
