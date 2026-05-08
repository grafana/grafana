import { DataSourceApi, type DataSourceRef, type ScopedVars } from '@grafana/data';

import { UserStorage } from '../../utils/userStorage';
import { type RuntimeDataSourceRegistration } from '../dataSourceSrv';

import { getDataSourceSettings, upsertRuntimeDataSource } from './instanceSettings';
import { getCachedPlugin, setCachedPlugin, setRuntimePlugin } from './pluginCache';
import { type GenericDataSourcePlugin, type ImportDataSourceFn } from './types';

let importDataSource: ImportDataSourceFn | undefined;

/**
 * Register the data source plugin importer. Called once from application boot.
 * The runtime package cannot depend on `public/app/features/plugins`, so the
 * concrete import function is injected here at startup.
 *
 * @internal
 */
export function setDataSourceImporter(fn: ImportDataSourceFn): void {
  importDataSource = fn;
}

/**
 * Load and return a data source plugin instance. Resolves the data source by
 * name, uid, or {@link DataSourceRef}, caches the constructed instance, and
 * reuses it on subsequent calls.
 *
 * @public
 */
export async function getDataSource(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceApi> {
  const settings = await getDataSourceSettings(ref, scopedVars);
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

  if (!importDataSource) {
    throw new Error('Data source importer has not been set. Call setDataSourceImporter during application boot.');
  }

  const dsPlugin = await importDataSource(settings.meta);

  // Another caller may have populated the cache while we were awaiting.
  const racedCache = getCachedPlugin(cacheUid);
  if (racedCache) {
    return racedCache;
  }

  const instance = new dsPlugin.DataSourceClass(settings);
  instance.components = dsPlugin.components;

  if (!instance.userStorage) {
    // DataSourceApi does not instantiate userStorage; DataSourceWithBackend does.
    instance.userStorage = new UserStorage(settings.type);
  }

  // Legacy plugins that don't extend DataSourceApi need manual patching.
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
 * {@link getInstanceSettings} and {@link getDataSource}.
 *
 * Runtime data sources are intentionally excluded from {@link getInstanceSettingsList}
 * results, matching the behaviour of the legacy `DatasourceSrv.registerRuntimeDataSource`.
 *
 * @public
 */
export function registerRuntimeDataSource(entry: RuntimeDataSourceRegistration): void {
  const { dataSource } = entry;

  if (getCachedPlugin(dataSource.uid)) {
    throw new Error(`A runtime data source with uid ${dataSource.uid} has already been registered`);
  }

  upsertRuntimeDataSource(dataSource.instanceSettings);
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
  importDataSource = undefined;
}
