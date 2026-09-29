import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
  isObject,
  matchPluginId,
} from '@grafana/data';

import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { isExpressionReference } from '../../utils/expressionRef';
import { getCachedPromise, invalidateCachedPromise } from '../../utils/getCachedPromise';
import { getDataSourceSrv, type GetDataSourceListFilters } from '../dataSourceSrv';
import { getTemplateSrv } from '../templateSrv';

import { createApiCacheProvider } from './apiCacheProvider';
import { createConfigCacheProvider } from './configCacheProvider';
import { FALLBACK_TO_LEGACY_LIST_WARNING, FALLBACK_TO_LEGACY_SETTINGS_WARNING } from './constants';
import { getExpressionDataSourceSettings, _resetForTests as resetExpressionDs } from './expressionDs';
import { describeRef, logDataSourceWarning } from './logging';
import { clearPluginCache } from './pluginCache';
import { type DataSourceSettingsCacheProvider } from './settingsCacheProvider';

let cacheProvider: DataSourceSettingsCacheProvider | undefined;

const RELOAD_CACHE_KEY = 'grafana-runtime:ds-reload';

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
  cacheProvider?.reset();
  const asyncEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsInitDataSourcesAsync, false);
  cacheProvider = asyncEnabled
    ? createApiCacheProvider(settings, defaultDsName)
    : createConfigCacheProvider(settings, defaultDsName);
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
  const defaultName = defaultDatasourceName ?? Object.values(settings).find((ds) => ds.isDefault)?.name ?? '';
  cacheProvider = createConfigCacheProvider(settings, defaultName);
}

/**
 * Clear the instance-settings cache and refetch from the backend. Resolves
 * when the refresh is complete.
 *
 * @public
 */
async function performReload(): Promise<void> {
  const srv = getDataSourceSrv();
  if (srv) {
    await srv.reload();
    return;
  }
  clearPluginCache();
  await cacheProvider?.refreshList();
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
 * Refresh the instance-settings cache after the legacy service reloads. The legacy path
 * reuses its `/api/frontend/settings` payload; the async path ignores that payload,
 * refreshes connections, and clears settings so they are fetched again on demand.
 *
 * Transition-period helper: while both the legacy `DataSourceSrv` and the new async
 * datasource APIs exist, `DataSourceSrv.reload()` calls this after updating itself.
 * Remove once `DataSourceSrv` is gone.
 *
 * @internal
 */
export function syncDataSourceInstanceSettings(settings: SyncDataSourceSettings): void {
  clearPluginCache();
  cacheProvider?.sync(settings.datasources, settings.defaultDatasource);
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
  await ensureSettingsProviderReady();

  if (cacheProvider?.source === 'api') {
    return getAsyncDataSourceInstanceSettings(ref, scopedVars);
  }

  const result = lookupFromMaps(ref, scopedVars);
  if (result) {
    return result;
  }
  return getInstanceSettingsFallback(ref, scopedVars);
}

async function ensureSettingsProviderReady(): Promise<void> {
  await cacheProvider?.waitUntilReady();
}

async function getAsyncDataSourceInstanceSettings(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): Promise<DataSourceInstanceSettings | undefined> {
  if (isExpressionReference(ref)) {
    return getExpressionDataSourceSettings();
  }

  const runtime = lookupRuntimeSettings(ref, scopedVars);
  if (runtime) {
    return runtime;
  }

  const resolved = resolveListItem(ref, scopedVars);
  if (!resolved) {
    return lookupFromBootMaps(ref, scopedVars) ?? getInstanceSettingsFallback(ref, scopedVars);
  }

  const cached = cacheProvider?.getSettingsByUid(resolved.item.uid);
  const settings = cached ?? (await cacheProvider?.refreshSettings(resolved.item.uid, resolved.item.type));
  if (!settings) {
    return getInstanceSettingsFallback(ref, scopedVars);
  }

  if (!resolved.rawRef) {
    return settings;
  }

  return {
    ...settings,
    isDefault: false,
    name: resolved.rawRef,
    uid: resolved.rawRef,
    rawRef: { type: settings.type, uid: settings.uid },
  };
}

function lookupFromBootMaps(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): DataSourceInstanceSettings | undefined {
  const nameOrUid = getNameOrUid(ref);
  if (nameOrUid == null || nameOrUid === 'default') {
    const defaultName = cacheProvider?.getDefaultName() ?? '';
    return cacheProvider?.getBootSettingsByName(defaultName) ?? cacheProvider?.getBootSettingsByUid(defaultName);
  }

  if (nameOrUid.includes('$')) {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    if (interpolated !== nameOrUid) {
      const resolved =
        interpolated === 'default'
          ? cacheProvider?.getBootSettingsByName(cacheProvider.getDefaultName())
          : (cacheProvider?.getBootSettingsByUid(interpolated) ??
            cacheProvider?.getBootSettingsByName(interpolated) ??
            cacheProvider?.getBootSettingsById(interpolated));
      return resolved
        ? {
            ...resolved,
            isDefault: false,
            name: nameOrUid,
            uid: nameOrUid,
            rawRef: { type: resolved.type, uid: resolved.uid },
          }
        : undefined;
    }
  }

  return (
    cacheProvider?.getBootSettingsByUid(nameOrUid) ??
    cacheProvider?.getBootSettingsByName(nameOrUid) ??
    cacheProvider?.getBootSettingsById(nameOrUid)
  );
}

function lookupRuntimeSettings(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): DataSourceInstanceSettings | undefined {
  const nameOrUid = getNameOrUid(ref);
  if (!nameOrUid) {
    return undefined;
  }

  if (nameOrUid.includes('$')) {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    const resolved = interpolated !== nameOrUid ? cacheProvider?.getRuntimeSettingsByUid(interpolated) : undefined;
    if (resolved) {
      return {
        ...resolved,
        isDefault: false,
        name: nameOrUid,
        uid: nameOrUid,
        rawRef: { type: resolved.type, uid: resolved.uid },
      };
    }
  }

  return cacheProvider?.getRuntimeSettingsByUid(nameOrUid);
}

interface ResolvedListItem {
  item: DataSourceInstanceListItem;
  rawRef?: string;
}

function resolveListItem(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): ResolvedListItem | undefined {
  const nameOrUid = getNameOrUid(ref);
  if (nameOrUid == null || nameOrUid === 'default') {
    if (isDataSourceRef(ref) && ref.type) {
      const matches = applyListFilters({ type: ref.type, all: true }).filter((item) => matchesType(item, ref.type!));
      const item = matches.find((candidate) => candidate.isDefault) ?? matches[0];
      return item ? { item } : undefined;
    }
    const defaultName = cacheProvider?.getDefaultName() ?? '';
    const item = cacheProvider?.getListItemByName(defaultName) ?? cacheProvider?.getListItemByUid(defaultName);
    return item ? { item } : undefined;
  }

  if (nameOrUid.includes('$')) {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    if (interpolated !== nameOrUid) {
      const defaultName = cacheProvider?.getDefaultName() ?? '';
      const item =
        interpolated === 'default'
          ? cacheProvider?.getListItemByName(defaultName)
          : (cacheProvider?.getListItemByUid(interpolated) ?? cacheProvider?.getListItemByName(interpolated));
      return item ? { item, rawRef: nameOrUid } : undefined;
    }
  }

  const item = cacheProvider?.getListItemByUid(nameOrUid) ?? cacheProvider?.getListItemByName(nameOrUid);
  return item ? { item } : undefined;
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
  await ensureSettingsProviderReady();

  if (cacheProvider?.source === 'api') {
    const results = applyListFilters(filters);
    if (results.length > 0) {
      return results;
    }
    const { filter: itemFilter, ...settingsFilters } = filters ?? {};
    const legacyFilter = itemFilter
      ? (settings: DataSourceInstanceSettings) => itemFilter(toListItem(settings))
      : undefined;
    return getInstanceSettingsListFallback({ ...settingsFilters, filter: legacyFilter }).map(toListItem);
  }

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

function applyListFilters(filters: GetDataSourceInstanceListFilters = {}): DataSourceInstanceListItem[] {
  const base = (cacheProvider?.getList() ?? []).filter((item) => {
    if (isBuiltInListItem(item)) {
      return false;
    }
    if (filters.metrics && !item.meta.metrics) {
      return false;
    }
    if (filters.tracing && !item.meta.tracing) {
      return false;
    }
    if (filters.logs && item.meta.category !== 'logging' && !item.meta.logs) {
      return false;
    }
    if (filters.annotations && !item.meta.annotations) {
      return false;
    }
    if (filters.alerting && !item.meta.alerting) {
      return false;
    }
    if (filters.pluginId && !matchPluginId(filters.pluginId, item.meta)) {
      return false;
    }
    if (filters.filter && !filters.filter(item)) {
      return false;
    }
    if (filters.type) {
      if (Array.isArray(filters.type)) {
        if (!filters.type.includes(item.type)) {
          return false;
        }
      } else if (!matchesType(item, filters.type)) {
        return false;
      }
    }
    if (
      !filters.all &&
      item.meta.metrics !== true &&
      item.meta.annotations !== true &&
      item.meta.tracing !== true &&
      item.meta.logs !== true &&
      item.meta.alerting !== true
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
      let value =
        variable.current.value === 'default' ? (cacheProvider?.getDefaultName() ?? '') : variable.current.value;
      if (Array.isArray(value)) {
        value = value[0];
      }
      if (typeof value !== 'string') {
        continue;
      }
      const item = cacheProvider?.getListItemByName(value) ?? cacheProvider?.getListItemByUid(value);
      if (item) {
        const key = `\${${variable.name}}`;
        base.push({ ...item, isDefault: false, name: key, uid: key });
      }
    }
  }

  base.sort((a, b) => {
    const first = a.name.toLowerCase();
    const second = b.name.toLowerCase();
    return first > second ? 1 : first < second ? -1 : 0;
  });

  if (!filters.pluginId && !filters.alerting) {
    if (filters.mixed) {
      const mixed = findBuiltInListItem('mixed');
      if (mixed) {
        base.push(mixed);
      }
    }
    if (filters.dashboard) {
      const dashboard = findBuiltInListItem('dashboard');
      if (dashboard) {
        base.push(dashboard);
      }
    }
    if (!filters.tracing) {
      const grafana = findBuiltInListItem('grafana');
      if (grafana && filters.filter?.(grafana) !== false) {
        base.push(grafana);
      }
    }
  }

  return base;
}

function isBuiltInListItem(item: DataSourceInstanceListItem): boolean {
  return item.meta.id === 'grafana' || item.meta.id === 'mixed' || item.meta.id === 'dashboard';
}

function findBuiltInListItem(id: string): DataSourceInstanceListItem | undefined {
  return cacheProvider?.getList().find((item) => item.meta.id === id);
}

// Expressions use their own settings object rather than being part of the datasource cache.
function lookupByUid(uid: string): DataSourceInstanceSettings | undefined {
  if (isExpressionReference(uid)) {
    return getExpressionDataSourceSettings();
  }
  return cacheProvider?.getSettingsByUid(uid);
}

export async function lookupListItemByUid(uid: string): Promise<DataSourceInstanceListItem | undefined> {
  await ensureSettingsProviderReady();
  const item = cacheProvider?.getListItemByUid(uid);
  if (item) {
    return item;
  }
  const runtime = lookupByUid(uid);
  return runtime ? toListItem(runtime) : undefined;
}

function toListItem(settings: DataSourceInstanceSettings): DataSourceInstanceListItem {
  return {
    uid: settings.uid,
    type: settings.type,
    apiVersion: settings.apiVersion,
    name: settings.name,
    meta: settings.meta,
    isDefault: settings.isDefault ?? false,
  };
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
  cacheProvider?.registerRuntimeSettings(settings);
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
    const defaultName = cacheProvider?.getDefaultName() ?? '';
    return cacheProvider?.getSettingsByUid(defaultName) ?? cacheProvider?.getSettingsByName(defaultName);
  }

  // Template variable reference — interpolate and preserve the raw ref. The variable can
  // sit anywhere in the string (e.g. `logs-${stage}-loki`), not only at the start; legacy
  // DataSourceSrv.get() interpolates unconditionally. When interpolation changes nothing
  // (a datasource name that merely contains `$`), fall through to the plain lookup.
  if (nameOrUid.includes('$')) {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    if (interpolated !== nameOrUid) {
      // The plain lookup below reads three maps; this branch must read the same three. Legacy
      // DataSourceSrv.get() interpolates itself and then re-enters getInstanceSettings through
      // that plain branch, so it reaches the id map and this one has to as well.
      const resolved =
        interpolated === 'default'
          ? cacheProvider?.getSettingsByName(cacheProvider.getDefaultName())
          : (cacheProvider?.getSettingsByUid(interpolated) ??
            cacheProvider?.getSettingsByName(interpolated) ??
            cacheProvider?.getSettingsById(interpolated));
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
  }

  return (
    cacheProvider?.getSettingsByUid(nameOrUid) ??
    cacheProvider?.getSettingsByName(nameOrUid) ??
    cacheProvider?.getSettingsById(nameOrUid)
  );
}

function findByType(type: string): DataSourceInstanceSettings | undefined {
  const matches = applyFilters({ type });
  if (!matches.length) {
    return undefined;
  }
  return matches.find((s) => s.isDefault) ?? matches[0];
}

function applyFilters(filters: GetDataSourceListFilters = {}): DataSourceInstanceSettings[] {
  const base = (cacheProvider?.getSettingsList() ?? []).filter((x) => {
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
      let dsValue =
        variable.current.value === 'default' ? (cacheProvider?.getDefaultName() ?? '') : variable.current.value;
      if (Array.isArray(dsValue)) {
        dsValue = dsValue[0];
      }
      if (typeof dsValue !== 'string') {
        continue;
      }
      const dsSettings = cacheProvider?.getSettingsByName(dsValue) || cacheProvider?.getSettingsByUid(dsValue);
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
      const mixed = cacheProvider?.getSettingsByName('-- Mixed --') ?? cacheProvider?.getSettingsByUid('-- Mixed --');
      if (mixed) {
        results.push(mixed);
      }
    }
    if (filters.dashboard) {
      const dashboard =
        cacheProvider?.getSettingsByName('-- Dashboard --') ?? cacheProvider?.getSettingsByUid('-- Dashboard --');
      if (dashboard) {
        results.push(dashboard);
      }
    }
    if (!filters.tracing) {
      const grafana =
        cacheProvider?.getSettingsByName('-- Grafana --') ?? cacheProvider?.getSettingsByUid('-- Grafana --');
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
  cacheProvider?.reset();
  cacheProvider = undefined;
  invalidateCachedPromise(RELOAD_CACHE_KEY);
  resetExpressionDs();
}
