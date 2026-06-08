import {
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
  isObject,
  matchPluginId,
} from '@grafana/data';

import { ExpressionDatasourceRef, isExpressionReference } from '../../utils/DataSourceWithBackend';
import { getCachedPromise } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { type GetDataSourceListFilters } from '../dataSourceSrv';
import { getTemplateSrv } from '../templateSrv';

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

export async function reloadDataSourceInstanceSettings(): Promise<void> {
  clearPluginCache();
  await getCachedPromise(fetchAndPopulate, {
    cacheKey: RELOAD_CACHE_KEY,
    invalidate: true,
  });
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
  return lookupFromMaps(ref, scopedVars);
}

/**
 * Search and filter data source instance settings from the in-memory cache.
 *
 * @internal
 */
export async function getDataSourceInstanceSettingsList(
  filters?: GetDataSourceListFilters
): Promise<DataSourceInstanceSettings[]> {
  return applyFilters(filters);
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
    return byUid[ExpressionDatasourceRef.uid];
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
}
