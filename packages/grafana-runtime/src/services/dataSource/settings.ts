import { isEqual } from 'lodash';

import {
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
  isObject,
  matchPluginId,
} from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { isExpressionReference } from '../../utils/expressionRef';
import {
  getCachedPromise,
  getFetchErrorContext,
  getOriginMessage,
  invalidateCachedPromise,
} from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { getDataSourceSrv, type GetDataSourceListFilters } from '../dataSourceSrv';
import { getDatasourcePluginMetas } from '../pluginMeta/datasources';
import { getTemplateSrv } from '../templateSrv';

import {
  type DataSourceConnectionDescriptor,
  fetchDataSourceConnections,
  fetchDataSourceSettings,
  getDataSourceConnectionsUrl,
  getDataSourceSettingsUrl,
} from './api';
import { notifyDataSourceCacheChanged } from './cacheGeneration';
import {
  DATASOURCE_CONNECTION_MISSING_PLUGIN_WARNING,
  FALLBACK_TO_BOOTDATA_LIST_WARNING,
  FALLBACK_TO_BOOTDATA_SETTINGS_WARNING,
  FALLBACK_TO_LEGACY_LIST_WARNING,
  FALLBACK_TO_LEGACY_SETTINGS_WARNING,
} from './constants';
import { getExpressionDataSourceSettings, _resetForTests as resetExpressionDs } from './expressionDs';
import { describeRef, logDataSourceWarning } from './logging';
import { clearPluginCache } from './pluginCache';

let byName: Record<string, DataSourceInstanceSettings> = {};
let byUid: Record<string, DataSourceInstanceSettings> = {};
let byId: Record<string, DataSourceInstanceSettings> = {};
let runtimeByUid: Record<string, DataSourceInstanceSettings> = {};
let bootByName: Record<string, DataSourceInstanceSettings> = {};
let bootByUid: Record<string, DataSourceInstanceSettings> = {};
let bootById: Record<string, DataSourceInstanceSettings> = {};
let listByName: Record<string, DataSourceInstanceListItem> = {};
let listByUid: Record<string, DataSourceInstanceListItem> = {};
let connectionByUid: Record<string, DataSourceConnectionDescriptor> = {};
let defaultName = '';
let asyncInitializationEnabled = false;
let initializationGeneration = 0;
let initializedFromApi = false;

const INITIALIZATION_CACHE_KEY = 'grafana-runtime:ds-initialization';
const RELOAD_CACHE_KEY = 'grafana-runtime:ds-reload';
const SETTINGS_CACHE_KEY_PREFIX = 'grafana-runtime:ds-settings';
const settingsCacheKeys = new Set<string>();

function populateMaps(settings: Record<string, DataSourceInstanceSettings>) {
  byName = {};
  byUid = {};
  byId = {};

  for (const dsSettings of Object.values(settings)) {
    upsertSettings(dsSettings);
  }

  // Re-apply any previously registered runtime data sources so they survive a refetch.
  for (const ds of Object.values(runtimeByUid)) {
    byUid[ds.uid] = ds;
  }
}

function upsertSettings(input: DataSourceInstanceSettings): DataSourceInstanceSettings {
  const settings = input.uid ? input : { ...input, uid: input.name };
  byName[settings.name] = settings;
  byUid[settings.uid] = settings;
  if (settings.id) {
    byId[String(settings.id)] = settings;
  }
  return settings;
}

function populateBootMaps(settings: Record<string, DataSourceInstanceSettings>): void {
  bootByName = {};
  bootByUid = {};
  bootById = {};

  for (const input of Object.values(structuredClone(settings))) {
    const value = input.uid ? input : { ...input, uid: input.name };
    bootByName[value.name] = value;
    bootByUid[value.uid] = value;
    if (value.id) {
      bootById[String(value.id)] = value;
    }
  }
}

function populateListFromSettings(settings: Record<string, DataSourceInstanceSettings>): void {
  commitList(
    Object.values(settings).map((value) => toListItem(value.uid ? value : { ...value, uid: value.name })),
    {}
  );
}

function commitList(
  items: DataSourceInstanceListItem[],
  connections: Record<string, DataSourceConnectionDescriptor>
): void {
  listByName = {};
  listByUid = {};
  for (const item of items) {
    listByName[item.name] = item;
    listByUid[item.uid] = item;
  }
  connectionByUid = connections;
}

function clearFetchedSettings(): void {
  byName = {};
  byUid = {};
  byId = {};
  for (const settings of Object.values(runtimeByUid)) {
    byUid[settings.uid] = settings;
  }

  for (const key of settingsCacheKeys) {
    invalidateCachedPromise(key);
  }
  settingsCacheKeys.clear();
}

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
  defaultName = defaultDsName;
  populateBootMaps(settings);
  asyncInitializationEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsInitDataSourcesAsync, false);

  if (!asyncInitializationEnabled) {
    populateMaps(structuredClone(settings));
    populateListFromSettings(settings);
    notifyDataSourceCacheChanged();
    return;
  }

  clearFetchedSettings();
  void ensureDataSourceInstanceSettingsInitialized();
}

function connectionsRouteEnabled(): boolean {
  // These flags register and enable the route at process startup, so checking the
  // boot-time values avoids issuing a request that is guaranteed to return 404/501.
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  const queryServiceEnabled = config.featureToggles.queryService;
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  const experimentalApiServerEnabled = config.featureToggles.grafanaAPIServerWithExperimentalAPIs;
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  const connectionsEnabled = config.featureToggles.queryServiceWithConnections;
  return Boolean((queryServiceEnabled || experimentalApiServerEnabled) && connectionsEnabled);
}

async function ensureDataSourceInstanceSettingsInitialized(): Promise<void> {
  if (!asyncInitializationEnabled) {
    return;
  }
  await getCachedPromise(() => loadAndCommitConnections('startup'), { cacheKey: INITIALIZATION_CACHE_KEY });
}

async function loadAndCommitConnections(operation: 'startup' | 'reload'): Promise<void> {
  const generation = initializationGeneration;

  if (!connectionsRouteEnabled()) {
    commitBootFallback(generation, operation, 'prerequisites-disabled');
    return;
  }

  try {
    const [response, metas] = await Promise.all([fetchDataSourceConnections(), getDatasourcePluginMetas()]);
    const metaById = new Map(metas.map((meta) => [meta.id, meta]));
    const metaByAlias = new Map(metas.flatMap((meta) => (meta.aliasIDs ?? []).map((alias) => [alias, meta])));
    const items: DataSourceInstanceListItem[] = [];
    const connections: Record<string, DataSourceConnectionDescriptor> = {};

    for (const connection of response.items ?? []) {
      if (!connection.plugin) {
        logDataSourceWarning(DATASOURCE_CONNECTION_MISSING_PLUGIN_WARNING, {
          dataSourceUid: connection.name,
          dataSourceName: connection.title,
          operation,
          requestUrl: getDataSourceConnectionsUrl(),
        });
        continue;
      }

      const meta = metaById.get(connection.plugin) ?? metaByAlias.get(connection.plugin);
      if (!meta) {
        continue;
      }

      const item: DataSourceInstanceListItem = {
        uid: connection.name,
        name: connection.title,
        type: meta.id,
        meta,
        isDefault: connection.title === defaultName,
      };
      items.push(item);
      connections[item.uid] = { group: connection.group, version: connection.version };
    }

    // Built-ins do not have connection rows. Preserve their established identity while
    // sourcing plugin metadata from the metadata cache whenever it is available.
    for (const boot of Object.values(bootByName).filter(isBuiltInSettings)) {
      const meta = metaById.get(boot.meta.id) ?? boot.meta;
      items.push({ ...toListItem(boot), meta });
    }

    if (operation === 'startup') {
      validateListParity(items);
    }
    if (generation !== initializationGeneration) {
      return;
    }

    commitList(items, connections);
    initializedFromApi = true;
    notifyDataSourceCacheChanged();
  } catch (error) {
    commitBootFallback(generation, operation, getOriginMessage(error) || 'request-failed', error);
  }
}

function commitBootFallback(
  generation: number,
  operation: 'startup' | 'reload',
  reason: string,
  error?: unknown
): void {
  if (generation !== initializationGeneration) {
    return;
  }

  if (!initializedFromApi || Object.keys(listByUid).length === 0) {
    populateListFromSettings(bootByName);
    populateMaps(structuredClone(bootByName));
  }
  notifyDataSourceCacheChanged();

  logDataSourceWarning(FALLBACK_TO_BOOTDATA_LIST_WARNING, {
    operation,
    reason,
    requestUrl: getDataSourceConnectionsUrl(),
    ...getFetchErrorContext(error),
  });
}

function validateListParity(items: DataSourceInstanceListItem[]): void {
  const expected = Object.values(bootByName).map(toListItem).map(listItemForComparison).sort(compareByUid);
  const actual = items.map(listItemForComparison).sort(compareByUid);

  if (!isEqual(actual, expected)) {
    throw new Error('datasource-list-parity-mismatch');
  }
}

function listItemForComparison(item: DataSourceInstanceListItem) {
  return {
    uid: item.uid,
    name: item.name,
    type: item.type,
    apiVersion: item.apiVersion,
    isDefault: item.isDefault,
    pluginId: item.meta.id,
  };
}

function compareByUid(a: { uid: string }, b: { uid: string }): number {
  return a.uid > b.uid ? 1 : a.uid < b.uid ? -1 : 0;
}

function isBuiltInSettings(settings: DataSourceInstanceSettings): boolean {
  return settings.meta.id === 'grafana' || settings.meta.id === 'mixed' || settings.meta.id === 'dashboard';
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
  populateBootMaps(settings);
  populateMaps(structuredClone(settings));
  populateListFromSettings(settings);
  defaultName = defaultDatasourceName ?? Object.values(settings).find((ds) => ds.isDefault)?.name ?? '';
  notifyDataSourceCacheChanged();
}

/**
 * Clear the instance-settings cache and refetch from the backend. Resolves
 * when the refresh is complete.
 *
 * @public
 */
async function fetchAndPopulate(): Promise<void> {
  const settings = await getBackendSrv().get('/api/frontend/settings');
  populateMaps(settings.datasources);
  populateBootMaps(settings.datasources);
  populateListFromSettings(settings.datasources);
  defaultName = settings.defaultDatasource;
  notifyDataSourceCacheChanged();
}

async function refreshAsyncDataSourceCaches(): Promise<void> {
  initializationGeneration++;
  clearFetchedSettings();
  invalidateCachedPromise(INITIALIZATION_CACHE_KEY);
  await getCachedPromise(() => loadAndCommitConnections('reload'), { cacheKey: INITIALIZATION_CACHE_KEY });
}

async function performReload(): Promise<void> {
  const srv = getDataSourceSrv();
  if (srv) {
    await srv.reload();
    return;
  }
  clearPluginCache();
  if (asyncInitializationEnabled) {
    await refreshAsyncDataSourceCaches();
  } else {
    await fetchAndPopulate();
  }
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
  if (asyncInitializationEnabled) {
    void refreshAsyncDataSourceCaches().catch((error) => {
      logDataSourceWarning(FALLBACK_TO_BOOTDATA_LIST_WARNING, {
        operation: 'reload',
        reason: getOriginMessage(error) || 'refresh-failed',
        requestUrl: getDataSourceConnectionsUrl(),
        ...getFetchErrorContext(error),
      });
    });
    return;
  }
  populateMaps(settings.datasources);
  populateBootMaps(settings.datasources);
  populateListFromSettings(settings.datasources);
  defaultName = settings.defaultDatasource;
  notifyDataSourceCacheChanged();
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
  await ensureDataSourceInstanceSettingsInitialized();

  if (asyncInitializationEnabled && initializedFromApi) {
    return getAsyncDataSourceInstanceSettings(ref, scopedVars);
  }

  const result = lookupFromMaps(ref, scopedVars);
  if (result) {
    return result;
  }
  return getInstanceSettingsFallback(ref, scopedVars);
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

  const cached = byUid[resolved.item.uid];
  const settings = cached ?? (await loadDataSourceInstanceSettings(resolved.item));
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
    return bootByName[defaultName] ?? bootByUid[defaultName];
  }

  if (nameOrUid.includes('$')) {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    if (interpolated !== nameOrUid) {
      const resolved =
        interpolated === 'default'
          ? bootByName[defaultName]
          : (bootByUid[interpolated] ?? bootByName[interpolated] ?? bootById[interpolated]);
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

  return bootByUid[nameOrUid] ?? bootByName[nameOrUid] ?? bootById[nameOrUid];
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
    const resolved = interpolated !== nameOrUid ? runtimeByUid[interpolated] : undefined;
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

  return runtimeByUid[nameOrUid];
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
    const item = listByName[defaultName] ?? listByUid[defaultName];
    return item ? { item } : undefined;
  }

  if (nameOrUid.includes('$')) {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    if (interpolated !== nameOrUid) {
      const item =
        interpolated === 'default' ? listByName[defaultName] : (listByUid[interpolated] ?? listByName[interpolated]);
      return item ? { item, rawRef: nameOrUid } : undefined;
    }
  }

  const item = listByUid[nameOrUid] ?? listByName[nameOrUid];
  return item ? { item } : undefined;
}

async function loadDataSourceInstanceSettings(
  item: DataSourceInstanceListItem
): Promise<DataSourceInstanceSettings | undefined> {
  const descriptor = connectionByUid[item.uid];
  if (!descriptor) {
    const cacheKey = `${SETTINGS_CACHE_KEY_PREFIX}:${initializationGeneration}:${item.uid}`;
    settingsCacheKeys.add(cacheKey);
    return getCachedPromise(
      async () => {
        const fallback = getBootOrLegacySettings(item.uid);
        if (!isBuiltInListItem(item)) {
          logDataSourceWarning(FALLBACK_TO_BOOTDATA_SETTINGS_WARNING, {
            operation: 'settings',
            reason: 'connection-not-found',
            pluginType: item.type,
            requestUrl: getDataSourceConnectionsUrl(),
          });
        }
        return fallback ? upsertSettings(fallback) : undefined;
      },
      { cacheKey }
    );
  }

  const generation = initializationGeneration;
  const cacheKey = `${SETTINGS_CACHE_KEY_PREFIX}:${generation}:${item.uid}`;
  settingsCacheKeys.add(cacheKey);

  return getCachedPromise(
    async () => {
      try {
        const settings = await fetchDataSourceSettings(item, descriptor);
        const fallback = getBootOrLegacySettings(item.uid);
        if (fallback && !settingsHaveParity(settings, fallback)) {
          logSettingsFallback(item, descriptor, 'datasource-settings-parity-mismatch');
          return generation === initializationGeneration ? upsertSettings(fallback) : fallback;
        }
        return generation === initializationGeneration ? upsertSettings(settings) : settings;
      } catch (error) {
        const fallback = getBootOrLegacySettings(item.uid);
        logSettingsFallback(item, descriptor, getOriginMessage(error) || 'request-failed', error);
        if (!fallback) {
          return undefined;
        }
        return generation === initializationGeneration ? upsertSettings(fallback) : fallback;
      }
    },
    { cacheKey }
  );
}

function getBootOrLegacySettings(uid: string): DataSourceInstanceSettings | undefined {
  return getDataSourceSrv()?.getInstanceSettings(uid) ?? bootByUid[uid];
}

function settingsHaveParity(actual: DataSourceInstanceSettings, expected: DataSourceInstanceSettings): boolean {
  return isEqual(settingsForComparison(actual), settingsForComparison(expected));
}

function settingsForComparison(settings: DataSourceInstanceSettings) {
  return {
    id: settings.id,
    uid: settings.uid,
    type: settings.type,
    apiVersion: settings.apiVersion,
    name: settings.name,
    cachingConfig: settings.cachingConfig,
    readOnly: settings.readOnly,
    url: settings.url,
    jsonData: settings.jsonData,
    username: settings.username,
    password: settings.password,
    database: settings.database,
    isDefault: settings.isDefault ?? false,
    access: settings.access,
    basicAuth: settings.basicAuth,
    withCredentials: settings.withCredentials,
  };
}

function logSettingsFallback(
  item: DataSourceInstanceListItem,
  descriptor: DataSourceConnectionDescriptor,
  reason: string,
  error?: unknown
): void {
  logDataSourceWarning(FALLBACK_TO_BOOTDATA_SETTINGS_WARNING, {
    operation: 'settings',
    reason,
    pluginType: item.type,
    requestUrl: getDataSourceSettingsUrl(item.uid, descriptor),
    ...getFetchErrorContext(error),
  });
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
  await ensureDataSourceInstanceSettingsInitialized();

  if (asyncInitializationEnabled) {
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
  const base = Object.values(listByName).filter((item) => {
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
      let value = variable.current.value === 'default' ? defaultName : variable.current.value;
      if (Array.isArray(value)) {
        value = value[0];
      }
      const item = !Array.isArray(value) && (listByName[value] ?? listByUid[value]);
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
  return Object.values(listByName).find((item) => item.meta.id === id);
}

// Expressions are included because `__expr__` (and the legacy `-100`) is the uid they are
// registered under; they sit outside `byUid` only because they are set at boot.
function lookupByUid(uid: string): DataSourceInstanceSettings | undefined {
  if (isExpressionReference(uid)) {
    return getExpressionDataSourceSettings();
  }
  return byUid[uid];
}

export async function lookupListItemByUid(uid: string): Promise<DataSourceInstanceListItem | undefined> {
  await ensureDataSourceInstanceSettingsInitialized();
  const item = listByUid[uid];
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
  if (runtimeByUid[settings.uid] || byUid[settings.uid] || bootByUid[settings.uid] || listByUid[settings.uid]) {
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
          ? byName[defaultName]
          : (byUid[interpolated] ?? byName[interpolated] ?? byId[interpolated]);
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
  bootByName = {};
  bootByUid = {};
  bootById = {};
  listByName = {};
  listByUid = {};
  connectionByUid = {};
  runtimeByUid = {};
  defaultName = '';
  asyncInitializationEnabled = false;
  initializationGeneration++;
  initializedFromApi = false;
  invalidateCachedPromise(INITIALIZATION_CACHE_KEY);
  invalidateCachedPromise(RELOAD_CACHE_KEY);
  for (const key of settingsCacheKeys) {
    invalidateCachedPromise(key);
  }
  settingsCacheKeys.clear();
  resetExpressionDs();
}
