import {
  DataSourceApi,
  type DataSourceJsonData,
  type DataSourcePlugin,
  type DataSourcePluginMeta,
  type DataSourceRef,
  type ScopedVars,
} from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { UserStorage } from '../../utils/userStorage';
import { type RuntimeDataSourceRegistration } from '../dataSourceSrv';

import { getInstanceSettings, upsertRuntimeDataSource } from './instanceSettings';

type GenericDataSourcePlugin = DataSourcePlugin<
  DataSourceApi<DataQuery, DataSourceJsonData>,
  DataQuery,
  DataSourceJsonData
>;

/**
 * Plugin importer injected from application code. The runtime package cannot
 * depend on `public/app/features/plugins/importer`, so the concrete importer
 * is registered at boot via {@link setDataSourcePluginImporter}.
 *
 * @internal
 */
export interface DataSourcePluginImporter {
  importDataSource(meta: DataSourcePluginMeta): Promise<GenericDataSourcePlugin>;
}

let pluginImporter: DataSourcePluginImporter | undefined;
const instances: Record<string, DataSourceApi> = {};
const runtimeByUid: Record<string, DataSourceApi> = {};

/**
 * Register the plugin importer implementation. Called once from application
 * boot so the runtime package can lazy-load data source plugins.
 *
 * @internal
 */
export function setDataSourcePluginImporter(importer: DataSourcePluginImporter): void {
  pluginImporter = importer;
}

function requireImporter(): DataSourcePluginImporter {
  if (!pluginImporter) {
    throw new Error(
      'DataSourcePluginImporter has not been set. Call setDataSourcePluginImporter during application boot.'
    );
  }
  return pluginImporter;
}

/**
 * Load and return a data source plugin instance. Resolves the data source by
 * name, uid, or {@link DataSourceRef}, caches the constructed instance, and
 * reuses it on subsequent calls.
 *
 * @public
 */
export async function getDataSourcePlugin(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceApi> {
  const settings = await getInstanceSettings(ref, scopedVars);
  if (!settings) {
    throw new Error(`Datasource ${describeRef(ref)} was not found`);
  }

  const cached = instances[settings.uid];
  if (cached) {
    return cached;
  }

  const runtime = runtimeByUid[settings.uid];
  if (runtime) {
    instances[settings.uid] = runtime;
    return runtime;
  }

  const dsPlugin = await requireImporter().importDataSource(settings.meta);

  // Another caller may have populated the cache while we were awaiting.
  if (instances[settings.uid]) {
    return instances[settings.uid];
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

  instances[settings.uid] = instance;
  return instance;
}

/**
 * Register a runtime data source. Writes to both the instance-settings cache
 * and the plugin-instance cache so the data source is available to
 * {@link getInstanceSettings}, {@link getInstanceSettingsList} and
 * {@link getDataSourcePlugin}.
 *
 * @public
 */
export function registerRuntimeDataSource(entry: RuntimeDataSourceRegistration): void {
  const { dataSource } = entry;

  if (runtimeByUid[dataSource.uid] || instances[dataSource.uid]) {
    throw new Error(`A runtime data source with uid ${dataSource.uid} has already been registered`);
  }

  upsertRuntimeDataSource(dataSource.instanceSettings);
  runtimeByUid[dataSource.uid] = dataSource;
  instances[dataSource.uid] = dataSource;
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
 * Test helper — resets all module state. Should only be called from tests.
 *
 * @internal
 */
export function _resetForTests(): void {
  pluginImporter = undefined;
  for (const key of Object.keys(instances)) {
    delete instances[key];
  }
  for (const key of Object.keys(runtimeByUid)) {
    delete runtimeByUid[key];
  }
}
