import { DataSourceApi, type DataSourceInstanceSettings, type DataSourceRef, type ScopedVars } from '@grafana/data';

import { isExpressionReference } from '../../utils/DataSourceWithBackend';
import { UserStorage } from '../../utils/userStorage';
import { type RuntimeDataSourceRegistration } from '../dataSourceSrv';

import { getExpressionDataSourceInstance } from './expressionDs';
import { logDataSourceInstanceError } from './logging';
import { getCachedPlugin, setCachedPlugin, setRuntimePlugin } from './pluginCache';
import { getDataSourceInstanceSettings, upsertRuntimeDataSourceInstanceSettings } from './settings';
import { type ImportDataSourcePluginFn } from './types';

let importDataSourcePlugin: ImportDataSourcePluginFn | undefined;
const inflightLoads = new Map<string, Promise<DataSourceApi>>();

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
  if (isExpressionReference(ref)) {
    const expressionDs = getExpressionDataSourceInstance();
    if (!expressionDs) {
      throw new Error(
        'Expression datasource has not been initialised. Call setExpressionDataSourceInstance during application boot.'
      );
    }
    return expressionDs;
  }

  const settings = await getDataSourceInstanceSettings(ref, scopedVars);
  if (!settings) {
    throw new Error(`Datasource ${describeRef(ref)} was not found`);
  }

  // When ref is a template variable, settings.uid is the raw variable string
  // (e.g. "${datasource}"). Use the resolved uid as the cache key so repeated
  // calls for the same variable don't create duplicate instances.
  const cacheUid = settings.rawRef?.uid ?? settings.uid;

  const cached = getCachedPlugin(cacheUid);
  if (cached) {
    return cached;
  }

  const inflight = inflightLoads.get(cacheUid);
  if (inflight) {
    return inflight;
  }

  const promise = loadDataSourceInstance(cacheUid, settings);
  inflightLoads.set(cacheUid, promise);

  try {
    return await promise;
  } finally {
    inflightLoads.delete(cacheUid);
  }
}

async function loadDataSourceInstance(cacheUid: string, settings: DataSourceInstanceSettings): Promise<DataSourceApi> {
  if (!importDataSourcePlugin) {
    throw new Error('Data source importer has not been set. Call setDataSourcePluginImporter during application boot.');
  }

  let dsPlugin;
  try {
    dsPlugin = await importDataSourcePlugin(settings.meta);
  } catch (error) {
    logDataSourceInstanceError(`Failed to import datasource plugin ${settings.name} (${settings.uid})`, error, {
      pluginId: settings.meta.id,
      uid: settings.uid,
    });
    throw error;
  }

  const racedCache = getCachedPlugin(cacheUid);
  if (racedCache) {
    return racedCache;
  }

  const instance = new dsPlugin.DataSourceClass(settings);
  instance.components = dsPlugin.components;

  if (!instance.userStorage) {
    instance.userStorage = new UserStorage(settings.type);
  }

  if (!(instance instanceof DataSourceApi)) {
    const anyInstance: { [key: string]: unknown } = instance;
    anyInstance.name = settings.name;
    anyInstance.id = settings.id;
    anyInstance.type = settings.type;
    anyInstance.meta = settings.meta;
    anyInstance.uid = settings.uid;
    anyInstance.getRef = DataSourceApi.prototype.getRef;
  }

  setCachedPlugin(cacheUid, instance);
  return instance;
}

/**
 * Register a runtime data source. Writes to both the instance-settings cache
 * and the plugin-instance cache so the data source is available to
 * {@link getDataSourceInstanceSettings} and {@link getDataSourceInstance}.
 *
 * Runtime data sources are intentionally excluded from {@link getDataSourceInstanceSettingsList}
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
}

function describeRef(ref: DataSourceRef | string | null | undefined): string {
  if (ref == null) {
    return 'default';
  }
  if (typeof ref === 'string') {
    return ref;
  }
  return ref.uid ?? ref.type ?? 'unknown';
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
