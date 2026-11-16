import {
  AppEvents,
  DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceRef,
  type ScopedVars,
} from '@grafana/data';

import { isExpressionReference } from '../../utils/expressionRef';
import { UserStorage } from '../../utils/userStorage';
import { getAppEvents } from '../appEvents';
import { getDataSourceSrv, type RuntimeDataSourceRegistration } from '../dataSourceSrv';
import { getDatasourcePluginMeta, getPluginIdFromDatasourceInstanceType } from '../pluginMeta/datasources';
import { logPluginMetaWarning } from '../pluginMeta/logging';

import { notifyDataSourceCacheChanged } from './cacheGeneration';
import { FALLBACK_TO_LEGACY_INSTANCE_WARNING } from './constants';
import { DataSourcePluginImportError, isDataSourceLoadError } from './errors';
import { getExpressionDataSourceInstance } from './expressionDs';
import { describeRef, logDataSourceInstanceError, logDataSourceWarning } from './logging';
import { getCachedPlugin, getPluginCacheGeneration, setCachedPlugin, setRuntimePlugin } from './pluginCache';
import { getDataSourceInstanceSettings, upsertRuntimeDataSourceInstanceSettings } from './settings';
import { type ImportDataSourcePluginFn } from './types';

let importDataSourcePlugin: ImportDataSourcePluginFn | undefined;
const inflightLoads = new Map<string, { generation: number; promise: Promise<DataSourceApi> }>();

/**
 * Register the data source plugin importer. Called once from application boot.
 * The runtime package cannot depend on `public/app/features/plugins`, so the
 * concrete import function is injected here at startup.
 *
 * @internal
 */
export function setDataSourcePluginImporter(fn: ImportDataSourcePluginFn): void {
  importDataSourcePlugin = fn;
}

/**
 * Load and return a data source plugin instance. Resolves the data source by
 * name, uid, or {@link DataSourceRef}, caches the constructed instance, and
 * reuses it on subsequent calls. Concurrent callers for the same uid share
 * a single in-flight load.
 *
 * @public
 */
export async function getDataSourceInstance(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceApi> {
  ref = normalizeEmptyRef(ref);

  if (isExpressionReference(ref)) {
    const expressionDs = getExpressionDataSourceInstance();
    if (!expressionDs) {
      throw new Error(
        'Expression datasource has not been initialised. Call setExpressionDataSourceInstance during application boot.'
      );
    }
    return expressionDs;
  }

  try {
    let settings = await getDataSourceInstanceSettings(ref, scopedVars);
    if (!settings) {
      throw new Error(`Datasource ${describeRef(ref)} was not found`);
    }

    // When ref is a template variable, the settings keep the variable string in uid/name
    // (e.g. "${datasource}") with the resolved uid in rawRef — correct for the settings API,
    // but a plugin instance built from them would carry the variable as its identity. Legacy
    // DatasourceSrv.get() interpolates and returns the concrete instance, so re-resolve
    // through rawRef and construct/cache from the concrete settings.
    if (settings.rawRef && settings.rawRef.uid !== settings.uid) {
      settings = await getDataSourceInstanceSettings(settings.rawRef);
      if (!settings) {
        throw new Error(`Datasource ${describeRef(ref)} was not found`);
      }
    }

    // `await` (not a bare `return`) so a rejection reaches the catch below.
    return await loadDataSourceInstanceFromSettings(settings);
  } catch (err) {
    // The list or the settings failed to load. Boot data would hide that failure, so do not fall back.
    if (isDataSourceLoadError(err)) {
      throw err;
    }
    return getDataSourceInstanceFallback(ref, scopedVars, err);
  }
}

// Legacy DataSourceSrv.get() treats an empty ref ('' or { uid: '' }) as "default datasource"
// (or a type-only lookup when ref.type is set). getDataSourceInstanceSettings only does this
// for null/undefined, so normalize here to keep getDataSourceInstance in parity with get().
function normalizeEmptyRef(ref: DataSourceRef | string | null | undefined): DataSourceRef | string | null | undefined {
  if (ref === '') {
    return undefined;
  }
  if (typeof ref === 'object' && ref !== null && ref.uid === '') {
    // Keep the object only when a type-only lookup is possible; otherwise this is a plain
    // "default datasource" request (same as an empty string), and normalizing to undefined
    // lets describeRef report 'default' instead of 'unknown' if resolution fails.
    return ref.type ? { ...ref, uid: undefined } : undefined;
  }
  return ref;
}

/**
 * Load the plugin instance for already-resolved instance settings. This is the single loader and
 * instance cache behind both {@link getDataSourceInstance} and the legacy `DataSourceSrv.get()`,
 * so one data source never has two live instances. Concurrent callers for the same uid share one
 * in-flight load. A load that started before the cache was cleared (for example by a reload) still
 * resolves for its callers, but it is not cached and later callers do not join it.
 *
 * On an import or construction failure it logs, shows the `"<name> plugin failed"` alert, and
 * throws {@link DataSourcePluginImportError}. Nothing is cached, so the next call retries.
 *
 * `importer` defaults to the one registered with {@link setDataSourcePluginImporter}. The legacy
 * `DataSourceSrv` passes its own so it keeps working where the boot registration did not run.
 *
 * @internal
 */
export async function loadDataSourceInstanceFromSettings(
  settings: DataSourceInstanceSettings,
  importer: ImportDataSourcePluginFn | undefined = importDataSourcePlugin
): Promise<DataSourceApi> {
  const cacheUid = settings.uid;

  const cached = getCachedPlugin(cacheUid);
  if (cached) {
    return cached;
  }

  const generation = getPluginCacheGeneration();
  const inflight = inflightLoads.get(cacheUid);
  if (inflight?.generation === generation) {
    return inflight.promise;
  }

  const entry = { generation, promise: loadDataSourceInstance(cacheUid, settings, importer, generation) };
  inflightLoads.set(cacheUid, entry);

  try {
    return await entry.promise;
  } finally {
    // A load from a newer generation may have replaced this entry. Leave that one in place.
    if (inflightLoads.get(cacheUid) === entry) {
      inflightLoads.delete(cacheUid);
    }
  }
}

async function loadDataSourceInstance(
  cacheUid: string,
  settings: DataSourceInstanceSettings,
  importer: ImportDataSourcePluginFn | undefined,
  generation: number
): Promise<DataSourceApi> {
  if (!importer) {
    throw new Error('Data source importer has not been set. Call setDataSourcePluginImporter during application boot.');
  }

  // Built-in frontend data sources (-- Grafana --, -- Mixed --, -- Dashboard --) have type 'datasource'.
  const pluginId = getPluginIdFromDatasourceInstanceType(settings.type, settings.name);

  let instance: DataSourceApi;
  try {
    // Fall back to settings.meta when the plugin meta lookup misses so that runtime-registered
    // data sources (which are not in the plugin meta map) still load.
    let meta = await getDatasourcePluginMeta(pluginId);
    if (!meta) {
      logPluginMetaWarning(
        `Plugin meta for datasource ${settings.uid} (pluginId: ${pluginId}) was not found, falling back to instanceSettings.meta`,
        { pluginId, key: settings.uid }
      );
      meta = settings.meta;
    }

    const dsPlugin = await importer(meta);

    const racedCache = getCachedPlugin(cacheUid);
    if (racedCache) {
      return racedCache;
    }

    instance = new dsPlugin.DataSourceClass(settings);
    instance.components = dsPlugin.components;

    if (!instance.userStorage) {
      // DataSourceApi does not instantiate a userStorage property, but DataSourceWithBackend does.
      instance.userStorage = new UserStorage(settings.type);
    }

    // Some old plugins do not extend DataSourceApi, so patch them manually.
    if (!(instance instanceof DataSourceApi)) {
      const anyInstance: { [key: string]: unknown } = instance;
      anyInstance.name = settings.name;
      anyInstance.id = settings.id;
      anyInstance.type = pluginId;
      anyInstance.meta = meta;
      anyInstance.uid = settings.uid;
      anyInstance.getRef = DataSourceApi.prototype.getRef;
    }
  } catch (error) {
    logDataSourceInstanceError(`Failed to import datasource plugin ${settings.name} (${settings.uid})`, error, {
      pluginId,
      uid: settings.uid,
      name: settings.name,
    });
    if (error instanceof Error) {
      getAppEvents()?.publish({
        type: AppEvents.alertError.name,
        payload: [settings.name + ' plugin failed', error.toString()],
      });
    }
    throw new DataSourcePluginImportError(settings.uid, error);
  }

  if (generation === getPluginCacheGeneration()) {
    setCachedPlugin(cacheUid, instance);
  }
  return instance;
}

/**
 * Register a runtime data source. Writes to both the instance-settings cache
 * and the plugin-instance cache so the data source is available to
 * {@link getDataSourceInstanceSettings} and {@link getDataSourceInstance}.
 *
 * Runtime data sources are intentionally excluded from {@link getDataSourceInstanceList}
 * results, matching the behaviour of the legacy `DatasourceSrv.registerRuntimeDataSourceInstance`.
 *
 * @public
 */
export function registerRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void {
  const { dataSource } = entry;

  if (getCachedPlugin(dataSource.uid)) {
    throw new Error(`A runtime data source with uid ${dataSource.uid} has already been registered`);
  }

  upsertRuntimeDataSourceInstanceSettings(dataSource.instanceSettings);
  setRuntimePlugin(dataSource.uid, dataSource);
  notifyDataSourceCacheChanged();
}

/**
 * Last resort while the legacy `DataSourceSrv` still exists: the new path failed to resolve
 * the data source. If the legacy service can resolve it, that's a divergence worth tracking;
 * otherwise rethrow the original error so a genuine "not found" stays an error and is not
 * logged. Delete this (and its call site) once `DataSourceSrv` is gone.
 */
async function getDataSourceInstanceFallback(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined,
  originalError: unknown
): Promise<DataSourceApi> {
  const srv = getDataSourceSrv();
  if (srv) {
    const legacy = await srv.get(ref, scopedVars).catch(() => undefined);
    if (legacy) {
      logDataSourceWarning(FALLBACK_TO_LEGACY_INSTANCE_WARNING, { ref: describeRef(ref) });
      return legacy;
    }
  }
  throw originalError;
}

/**
 * Test helper — resets module-local state. Should only be called from tests.
 *
 * @internal
 */
export function _resetForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTests must only be called from tests');
  }
  importDataSourcePlugin = undefined;
  inflightLoads.clear();
}
