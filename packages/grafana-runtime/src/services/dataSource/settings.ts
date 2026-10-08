import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
} from '@grafana/data';

import { isExpressionReference } from '../../utils/expressionRef';
import { getCachedPromise, invalidateCachedPromise } from '../../utils/getCachedPromise';
import { getDataSourceSrv, type GetDataSourceListFilters } from '../dataSourceSrv';

import {
  _resetForTests as resetCache,
  applySnapshot,
  awaitFill,
  getDataSourceCacheSource,
  loadSettingsCached,
  setDataSourceCacheSource,
  toListItem,
  upsertRuntimeSettings,
} from './cache';
import { FALLBACK_TO_LEGACY_LIST_WARNING, FALLBACK_TO_LEGACY_SETTINGS_WARNING } from './constants';
import { getExpressionDataSourceSettings, _resetForTests as resetExpressionDs } from './expressionDs';
import { applyFilters, type GetDataSourceInstanceListFilters } from './listFilters';
import { describeRef, logDataSourceWarning } from './logging';
import { clearPluginCache, _resetForTests as resetPluginCache } from './pluginCache';
import { resolveRef, _resetForTests as resetResolveRef } from './resolveRef';
import { BootDataSource, createBootDataSnapshot } from './sources/bootDataSource';
import { createDataSourceCacheSource } from './sources/selectSource';
import { type BootDataSourceSettings } from './sources/types';

export { toListItem } from './cache';
export type { GetDataSourceInstanceListFilters } from './listFilters';

/**
 * Populate the instance-settings cache from boot data. Intended to be called
 * exactly once at application startup via the `@grafana/runtime/internal` export.
 * In tests, use {@link setDataSourceInstanceSettings} instead.
 *
 * @internal
 */
export function initDataSourceInstanceSettings(
  settings: Record<string, DataSourceInstanceSettings>,
  defaultDsName: string
): void {
  setDataSourceCacheSource(createDataSourceCacheSource({ datasources: settings, defaultDatasource: defaultDsName }));
}

/**
 * Test helper — the sanctioned way to seed the instance-settings cache in tests.
 * Fully resets all module state (including runtime and expression data sources),
 * then populates the cache from a clone of `settings` so test fixtures are never
 * mutated. When `defaultDatasourceName` is omitted, the entry flagged with
 * `isDefault: true` becomes the default. Should only be called from tests.
 *
 * @internal
 */
export function setDataSourceInstanceSettings(
  settings: Record<string, DataSourceInstanceSettings>,
  defaultDatasourceName?: string
): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setDataSourceInstanceSettings() function can only be called from tests.');
  }

  _resetForTests();
  setDataSourceCacheSource(
    new BootDataSource({
      datasources: structuredClone(settings),
      defaultDatasource: defaultDatasourceName ?? Object.values(settings).find((ds) => ds.isDefault)?.name ?? '',
    })
  );
}

/**
 * Clear the instance-settings cache and refetch from the backend. Resolves
 * when the refresh is complete.
 *
 * @public
 */
const RELOAD_CACHE_KEY = 'grafana-runtime:ds-reload';

async function fetchAndPopulate(): Promise<void> {
  const source = getDataSourceCacheSource() ?? new BootDataSource({ datasources: {}, defaultDatasource: '' });
  applySnapshot(await source.refreshList());
}

async function performReload(): Promise<void> {
  const srv = getDataSourceSrv();
  if (srv) {
    await srv.reload();
    return;
  }
  clearPluginCache();
  await fetchAndPopulate();
}

export async function reloadDataSourceInstanceSettings(): Promise<void> {
  // Coalesce concurrent reloads into a single in-flight request via the shared promise
  // cache, then invalidate so a later call refetches rather than returning a stale result.
  try {
    await getCachedPromise(performReload, { cacheKey: RELOAD_CACHE_KEY });
  } finally {
    invalidateCachedPromise(RELOAD_CACHE_KEY);
  }
}

/**
 * Sync the instance-settings cache from an already-fetched `/api/frontend/settings`
 * payload, without issuing another backend request. Built-in (e.g. expression) and
 * runtime data sources survive because the cache re-applies them.
 *
 * Transition-period helper: while both the legacy `DataSourceSrv` and the new async
 * datasource APIs exist, `DataSourceSrv.reload()` calls this so a single fetch updates
 * both caches. Remove once `DataSourceSrv` is gone.
 *
 * @internal
 */
export function syncDataSourceInstanceSettings(settings: BootDataSourceSettings): void {
  clearPluginCache();
  applySnapshot(createBootDataSnapshot(settings));
}

/**
 * Look up the instance settings for a data source from the in-memory cache
 * populated at boot. Call {@link reloadDataSourceInstanceSettings} to refresh
 * the cache from the backend.
 *
 * `scopedVars` are used when `ref` contains a template variable (e.g. `$ds`).
 *
 * @public
 */
export async function getDataSourceInstanceSettings(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  await awaitFill();

  if (isExpressionReference(ref)) {
    return getExpressionDataSourceSettings() ?? getInstanceSettingsFallback(ref, scopedVars);
  }

  const resolved = resolveRef(ref, scopedVars);
  if (!resolved) {
    return getInstanceSettingsFallback(ref, scopedVars);
  }

  const settings = await loadSettingsCached(resolved.item.uid);
  if (!settings || !resolved.templated) {
    return settings;
  }

  return {
    ...settings,
    isDefault: false,
    name: resolved.templated,
    uid: resolved.templated,
    rawRef: { type: settings.type, uid: settings.uid },
  };
}

/**
 * Search and filter data sources from the in-memory cache, returning a
 * lightweight view of each match. The heavy per-instance settings are not
 * included — fetch them on demand via {@link getDataSourceInstanceSettings}.
 *
 * @public
 */
export async function getDataSourceInstanceList(
  filters?: GetDataSourceInstanceListFilters
): Promise<DataSourceInstanceListItem[]> {
  await awaitFill();

  const results = applyFilters(filters);
  if (results.length > 0) {
    return results;
  }

  // The legacy getList() filters settings, so adapt the slim filter for it.
  const { filter: itemFilter, ...settingsFilters } = filters ?? {};
  const settingsFilter = itemFilter ? (ds: DataSourceInstanceSettings) => itemFilter(toListItem(ds)) : undefined;
  return getInstanceSettingsListFallback({ ...settingsFilters, filter: settingsFilter }).map(toListItem);
}

// Mirrors the type predicate inside applyFilters, aliasID arm included.
function matchesType(item: DataSourceInstanceListItem, type: string): boolean {
  return item.type === type || (item.meta.aliasIDs?.includes(type) ?? false);
}

/**
 * Resolve the item flagged as the default data source, or `undefined` when the list holds none.
 *
 * At most one instance per org carries the flag, so a filtered list need not contain it.
 *
 * @public
 */
export async function getDefaultDataSourceInstanceListItem(
  items: DataSourceInstanceListItem[]
): Promise<DataSourceInstanceListItem | undefined> {
  return items.find((item) => item.isDefault);
}

/**
 * Check whether at least one data source instance of the given type is installed.
 *
 * Covers presence checks (`getList({ type }).length > 0`) without returning a list.
 *
 * @public
 */
export async function hasDataSourceInstance(type: string): Promise<boolean> {
  const list = await getDataSourceInstanceList({ type, all: true });
  return list.some((item) => matchesType(item, type));
}

/**
 * Register the instance settings for a runtime data source so it is returned
 * by future lookups. Throws if the uid is already in use.
 *
 * @internal
 */
export function upsertRuntimeDataSourceInstanceSettings(settings: DataSourceInstanceSettings): void {
  upsertRuntimeSettings(settings);
}

/**
 * Last resort while the legacy `DataSourceSrv` still exists: the new in-memory cache found
 * nothing, so consult the legacy service. If it resolves what the new path missed, that's a
 * divergence worth tracking. Delete this (and its call site) once `DataSourceSrv` is gone.
 */
function getInstanceSettingsFallback(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): DataSourceInstanceSettings | undefined {
  const legacy = getDataSourceSrv()?.getInstanceSettings(ref, scopedVars);
  if (legacy) {
    logDataSourceWarning(FALLBACK_TO_LEGACY_SETTINGS_WARNING, { ref: describeRef(ref) });
    return legacy;
  }
  return undefined;
}

/**
 * Last resort while the legacy `DataSourceSrv` still exists: the new in-memory cache produced
 * an empty list, so consult the legacy service. Delete this (and its call site) once
 * `DataSourceSrv` is gone.
 */
function getInstanceSettingsListFallback(filters: GetDataSourceListFilters | undefined): DataSourceInstanceSettings[] {
  const legacy = getDataSourceSrv()?.getList(filters) ?? [];
  if (legacy.length > 0) {
    logDataSourceWarning(FALLBACK_TO_LEGACY_LIST_WARNING, { filters: filtersForLog(filters) });
    return legacy;
  }
  return [];
}

function filtersForLog(filters: GetDataSourceListFilters | undefined): string {
  if (!filters) {
    return 'none';
  }
  // The `filter` callback can't be serialized; the rest is enough to identify the query.
  const { filter: _filter, ...rest } = filters;
  return JSON.stringify(rest);
}

/**
 * Test helper — resets all module state. Should only be called from tests.
 *
 * @internal
 */
export function _resetForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTests must only be called from tests');
  }
  resetCache();
  resetPluginCache();
  resetResolveRef();
  resetExpressionDs();
}
