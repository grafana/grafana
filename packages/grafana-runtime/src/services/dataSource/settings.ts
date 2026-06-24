import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
  isObject,
  matchPluginId,
} from '@grafana/data';

import { isExpressionReference } from '../../utils/DataSourceWithBackend';
import { getCachedPromise, invalidateCachedPromise } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { getDataSourceSrv, type GetDataSourceListFilters } from '../dataSourceSrv';
import { getTemplateSrv } from '../templateSrv';

import { FALLBACK_TO_LEGACY_LIST_WARNING, FALLBACK_TO_LEGACY_SETTINGS_WARNING } from './constants';
import { getExpressionDataSourceSettings, _resetForTests as resetExpressionDs } from './expressionDs';
import { describeRef, logDataSourceWarning } from './logging';
import { clearPluginCache } from './pluginCache';

let byName: Record<string, DataSourceInstanceSettings> = {};
let byUid: Record<string, DataSourceInstanceSettings> = {};
let byId: Record<string, DataSourceInstanceSettings> = {};
let runtimeByUid: Record<string, DataSourceInstanceSettings> = {};
let defaultName = '';

function populateMaps(settings: Record<string, DataSourceInstanceSettings>) {
  byName = {};
  byUid = {};
  byId = {};

  for (const dsSettings of Object.values(settings)) {
    if (!dsSettings.uid) {
      dsSettings.uid = dsSettings.name; // e.g. -- Grafana --, -- Mixed --
    }
    byName[dsSettings.name] = dsSettings;
    byUid[dsSettings.uid] = dsSettings;
    if (dsSettings.id) {
      byId[String(dsSettings.id)] = dsSettings;
    }
  }

  // Re-apply any previously registered runtime data sources so they survive a refetch.
  for (const ds of Object.values(runtimeByUid)) {
    byUid[ds.uid] = ds;
  }
}

/**
 * Populate the instance-settings cache from boot data. Intended to be called
 * exactly once at application startup via the `@grafana/runtime/internal` export.
 *
 * @internal
 */
export function initDataSourceInstanceSettings(
  settings: Record<string, DataSourceInstanceSettings>,
  defaultDsName: string
): void {
  defaultName = defaultDsName;
  populateMaps(settings);
}

/**
 * Clear the instance-settings cache and refetch from the backend. Resolves
 * when the refresh is complete.
 *
 * @public
 */
const RELOAD_CACHE_KEY = 'grafana-runtime:ds-reload';

async function fetchAndPopulate(): Promise<void> {
  const settings = await getBackendSrv().get('/api/frontend/settings');
  populateMaps(settings.datasources);
  defaultName = settings.defaultDatasource;
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

interface SyncDataSourceSettings {
  datasources: Record<string, DataSourceInstanceSettings>;
  defaultDatasource: string;
}

/**
 * Sync the instance-settings cache from an already-fetched `/api/frontend/settings`
 * payload, without issuing another backend request. Built-in (e.g. expression) and
 * runtime data sources survive because `populateMaps` re-applies them.
 *
 * Transition-period helper: while both the legacy `DataSourceSrv` and the new async
 * datasource APIs exist, `DataSourceSrv.reload()` calls this so a single fetch updates
 * both caches. Remove once `DataSourceSrv` is gone.
 *
 * @internal
 */
export function syncDataSourceInstanceSettings(settings: SyncDataSourceSettings): void {
  clearPluginCache();
  populateMaps(settings.datasources);
  defaultName = settings.defaultDatasource;
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
  const result = lookupFromMaps(ref, scopedVars);
  if (result) {
    return result;
  }
  return getInstanceSettingsFallback(ref, scopedVars);
}

/**
 * Filters for {@link getDataSourceInstanceList} and {@link useDataSourceInstanceList}.
 *
 * Identical to {@link GetDataSourceListFilters} except the `filter` callback receives a
 * {@link DataSourceInstanceListItem} instead of the full {@link DataSourceInstanceSettings}.
 * This reflects the long-term data model: the list API will only expose the slim item shape,
 * so filter callbacks must not rely on settings-specific fields such as `jsonData` or `url`.
 *
 * @public
 */
export interface GetDataSourceInstanceListFilters extends Omit<GetDataSourceListFilters, 'filter'> {
  /** Apply a function to filter the list. Receives a slim {@link DataSourceInstanceListItem}. */
  filter?: (item: DataSourceInstanceListItem) => boolean;
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
  const { filter: itemFilter, ...settingsFilters } = filters ?? {};
  // Wrap the slim filter into a settings-compatible callback so applyFilters applies
  // it with the same semantics as the legacy getList(): checked on base items and on
  // -- Grafana --, but NOT on -- Mixed -- or -- Dashboard -- (which are appended
  // unconditionally). Passing it through here avoids a post-map filter pass that would
  // incorrectly gate those built-ins.
  const settingsFilter = itemFilter ? (ds: DataSourceInstanceSettings) => itemFilter(toListItem(ds)) : undefined;
  const filtersWithAdapter = { ...settingsFilters, filter: settingsFilter };
  const results = applyFilters(filtersWithAdapter);
  return (results.length > 0 ? results : getInstanceSettingsListFallback(filtersWithAdapter)).map(toListItem);
}

function toListItem(settings: DataSourceInstanceSettings): DataSourceInstanceListItem {
  return {
    uid: settings.uid,
    type: settings.type,
    apiVersion: settings.apiVersion,
    name: settings.name,
    meta: settings.meta,
    readOnly: settings.readOnly,
    isDefault: settings.isDefault,
  };
}

// getDataSourceInstanceList appends the built-in -- Grafana -- data source to most results.
// It is suppressed when pluginId or alerting filters are set, when tracing is set, or when
// a custom filter callback returns false for it. Callers that want only true instances of a
// given type must re-check the type to guard against a false positive from that appended
// built-in. Mirrors the type predicate used inside applyFilters (exact type or aliasID match).
function matchesType(item: DataSourceInstanceListItem, type: string): boolean {
  return item.type === type || (item.meta.aliasIDs?.includes(type) ?? false);
}

/**
 * Resolve the default data source instance of a given type. Returns the instance flagged
 * as default, otherwise the first instance of that type, or `undefined` when none exist.
 *
 * Covers the common "get my data source" pattern (`list.find(ds => ds.isDefault) ?? list[0]`)
 * without exposing the full list. The heavy per-instance settings are not included — fetch
 * them on demand via {@link getDataSourceInstanceSettings}.
 *
 * @public
 */
export async function getDefaultDataSourceInstanceListItem(
  type: string
): Promise<DataSourceInstanceListItem | undefined> {
  const list = (await getDataSourceInstanceList({ type, all: true })).filter((item) => matchesType(item, type));
  return list.find((item) => item.isDefault) ?? list[0];
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
  if (runtimeByUid[settings.uid] || byUid[settings.uid]) {
    throw new Error(`A data source with uid ${settings.uid} has already been registered`);
  }
  runtimeByUid[settings.uid] = settings;
  byUid[settings.uid] = settings;
}

function lookupFromMaps(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): DataSourceInstanceSettings | undefined {
  if (isExpressionReference(ref)) {
    return getExpressionDataSourceSettings();
  }

  const nameOrUid = getNameOrUid(ref);

  if (nameOrUid == null || nameOrUid === 'default') {
    if (isDataSourceRef(ref) && ref.type) {
      const byType = findByType(ref.type);
      if (byType) {
        return byType;
      }
    }
    return byUid[defaultName] ?? byName[defaultName];
  }

  // Template variable reference — interpolate and preserve the raw ref.
  if (nameOrUid[0] === '$') {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    const resolved = interpolated === 'default' ? byName[defaultName] : (byUid[interpolated] ?? byName[interpolated]);
    if (!resolved) {
      return undefined;
    }
    return {
      ...resolved,
      isDefault: false,
      name: nameOrUid,
      uid: nameOrUid,
      rawRef: { type: resolved.type, uid: resolved.uid },
    };
  }

  return byUid[nameOrUid] ?? byName[nameOrUid] ?? byId[nameOrUid];
}

function findByType(type: string): DataSourceInstanceSettings | undefined {
  const matches = applyFilters({ type });
  if (!matches.length) {
    return undefined;
  }
  return matches.find((s) => s.isDefault) ?? matches[0];
}

function applyFilters(filters: GetDataSourceListFilters = {}): DataSourceInstanceSettings[] {
  const base = Object.values(byName).filter((x) => {
    if (x.meta.id === 'grafana' || x.meta.id === 'mixed' || x.meta.id === 'dashboard') {
      return false;
    }
    if (filters.metrics && !x.meta.metrics) {
      return false;
    }
    if (filters.tracing && !x.meta.tracing) {
      return false;
    }
    if (filters.logs && x.meta.category !== 'logging' && !x.meta.logs) {
      return false;
    }
    if (filters.annotations && !x.meta.annotations) {
      return false;
    }
    if (filters.alerting && !x.meta.alerting) {
      return false;
    }
    if (filters.pluginId && !matchPluginId(filters.pluginId, x.meta)) {
      return false;
    }
    if (filters.filter && !filters.filter(x)) {
      return false;
    }
    if (filters.type) {
      if (Array.isArray(filters.type)) {
        if (!filters.type.includes(x.type)) {
          return false;
        }
      } else if (!(x.type === filters.type || x.meta.aliasIDs?.includes(filters.type))) {
        return false;
      }
    }
    if (
      !filters.all &&
      x.meta.metrics !== true &&
      x.meta.annotations !== true &&
      x.meta.tracing !== true &&
      x.meta.logs !== true &&
      x.meta.alerting !== true
    ) {
      return false;
    }
    return true;
  });

  if (filters.variables) {
    for (const variable of getTemplateSrv().getVariables()) {
      if (variable.type !== 'datasource') {
        continue;
      }
      let dsValue = variable.current.value === 'default' ? defaultName : variable.current.value;
      if (Array.isArray(dsValue)) {
        dsValue = dsValue[0];
      }
      const dsSettings = !Array.isArray(dsValue) && (byName[dsValue] || byUid[dsValue]);
      if (dsSettings) {
        const key = `\${${variable.name}}`;
        base.push({
          ...dsSettings,
          isDefault: false,
          name: key,
          uid: key,
        });
      }
    }
  }

  const results = base.sort((a, b) => {
    if (a.name.toLowerCase() > b.name.toLowerCase()) {
      return 1;
    }
    if (a.name.toLowerCase() < b.name.toLowerCase()) {
      return -1;
    }
    return 0;
  });

  if (!filters.pluginId && !filters.alerting) {
    if (filters.mixed) {
      const mixed = byName['-- Mixed --'] ?? byUid['-- Mixed --'];
      if (mixed) {
        results.push(mixed);
      }
    }
    if (filters.dashboard) {
      const dashboard = byName['-- Dashboard --'] ?? byUid['-- Dashboard --'];
      if (dashboard) {
        results.push(dashboard);
      }
    }
    if (!filters.tracing) {
      const grafana = byName['-- Grafana --'] ?? byUid['-- Grafana --'];
      if (grafana && filters.filter?.(grafana) !== false) {
        results.push(grafana);
      }
    }
  }

  return results;
}

function getNameOrUid(ref: DataSourceRef | string | null | undefined): string | undefined {
  if (ref == null) {
    return undefined;
  }
  return typeof ref === 'string' ? ref : ref.uid;
}

function isDataSourceRef(ref: DataSourceRef | string | null | undefined): ref is DataSourceRef {
  return ref != null && isObject(ref) && 'type' in ref;
}

function variableInterpolation<T>(value: T | T[]): T {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
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
  byName = {};
  byUid = {};
  byId = {};
  runtimeByUid = {};
  defaultName = '';
  resetExpressionDs();
}
