import {
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
  isObject,
  matchPluginId,
} from '@grafana/data';

import { getCachedPromise } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { type GetDataSourceListFilters } from '../dataSourceSrv';
import { getTemplateSrv } from '../templateSrv';

/**
 * Paginated response shape. The initial implementation always returns
 * every item in a single page — `hasMore` is false and `nextCursor` undefined.
 * The shape is in place so callers don't need to migrate twice when real
 * pagination lands on the backend.
 *
 * @public
 */
export interface DataSourceInstanceSettingsPage {
  items: DataSourceInstanceSettings[];
  /** Opaque cursor for fetching the next page. Undefined when no more pages. */
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * @public
 */
export interface GetInstanceSettingsListOptions {
  filters?: GetDataSourceListFilters;
  /** Cursor returned by a previous call; omit to fetch the first page. */
  cursor?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_CACHE_KEY = 'grafana-runtime:ds-instance-settings';

let byName: Record<string, DataSourceInstanceSettings> = {};
let byUid: Record<string, DataSourceInstanceSettings> = {};
let byId: Record<string, DataSourceInstanceSettings> = {};
let runtimeByUid: Record<string, DataSourceInstanceSettings> = {};
let defaultName = '';
let fetchedAt = 0;

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
export function init(settings: Record<string, DataSourceInstanceSettings>, defaultDsName: string): void {
  defaultName = defaultDsName;
  populateMaps(settings);
  fetchedAt = Date.now();
}

async function fetchAndPopulate(): Promise<void> {
  const settings = await getBackendSrv().get('/api/frontend/settings');
  populateMaps(settings.datasources);
  defaultName = settings.defaultDatasource;
  fetchedAt = Date.now();
}

async function ensureFetched(): Promise<void> {
  if (fetchedAt > 0 && Date.now() - fetchedAt < CACHE_TTL_MS) {
    return;
  }

  // `getCachedPromise` deduplicates concurrent callers. Once resolved the
  // promise stays cached — we pass `invalidate: true` on re-fetch so a new
  // request is issued when the TTL has expired.
  await getCachedPromise(fetchAndPopulate, {
    cacheKey: FETCH_CACHE_KEY,
    invalidate: fetchedAt > 0,
  });
}

/**
 * Clear the instance-settings cache and refetch from the backend. Resolves
 * when the refresh is complete.
 *
 * @public
 */
export async function reload(): Promise<void> {
  fetchedAt = 0;
  await getCachedPromise(fetchAndPopulate, {
    cacheKey: FETCH_CACHE_KEY,
    invalidate: true,
  });
}

/**
 * Asynchronously look up the instance settings for a data source. Reads from
 * the in-memory cache and falls back to fetching `/api/frontend/settings` on
 * cache miss or when the TTL has expired.
 *
 * `scopedVars` are used when `ref` contains a template variable (e.g. `$ds`).
 *
 * @public
 */
export async function getInstanceSettings(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceSettings | undefined> {
  const found = lookup(ref, scopedVars);
  if (found) {
    return found;
  }
  await ensureFetched();
  return lookup(ref, scopedVars);
}

/**
 * Asynchronously list data source instance settings, optionally filtered.
 * Returns a paginated response; the initial implementation always returns
 * every matching item in a single page.
 *
 * @public
 */
export async function getInstanceSettingsList(
  options?: GetInstanceSettingsListOptions
): Promise<DataSourceInstanceSettingsPage> {
  await ensureFetched();
  const items = applyFilters(options?.filters);
  return { items, hasMore: false, nextCursor: undefined };
}

/**
 * Register the instance settings for a runtime data source so it is returned
 * by future lookups. Throws if the uid is already in use.
 *
 * @internal
 */
export function upsertRuntimeDataSource(settings: DataSourceInstanceSettings): void {
  if (runtimeByUid[settings.uid] || byUid[settings.uid]) {
    throw new Error(`A data source with uid ${settings.uid} has already been registered`);
  }
  runtimeByUid[settings.uid] = settings;
  byUid[settings.uid] = settings;
}

function lookup(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): DataSourceInstanceSettings | undefined {
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

  const sorted = base.sort((a, b) => {
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
        sorted.push(mixed);
      }
    }
    if (filters.dashboard) {
      const dashboard = byName['-- Dashboard --'] ?? byUid['-- Dashboard --'];
      if (dashboard) {
        sorted.push(dashboard);
      }
    }
    if (!filters.tracing) {
      const grafana = byName['-- Grafana --'] ?? byUid['-- Grafana --'];
      if (grafana && filters.filter?.(grafana) !== false) {
        sorted.push(grafana);
      }
    }
  }

  return sorted;
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
 * Test helper — resets all module state. Should only be called from tests.
 *
 * @internal
 */
export function _resetForTests(): void {
  byName = {};
  byUid = {};
  byId = {};
  runtimeByUid = {};
  defaultName = '';
  fetchedAt = 0;
}
