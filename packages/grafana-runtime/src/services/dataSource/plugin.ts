import { type DataSourceApi, type DataSourceRef, type ScopedVars } from '@grafana/data';

import { type RuntimeDataSourceRegistration } from '../dataSourceSrv';

import { upsertRuntimeDataSource } from './instanceSettings';

type GetDataSourcePluginFn = (ref?: DataSourceRef | string | null, scopedVars?: ScopedVars) => Promise<DataSourceApi>;

let getDataSourcePluginFn: GetDataSourcePluginFn | undefined;
const runtimeByUid: Record<string, DataSourceApi> = {};

/**
 * Register the implementation of {@link getDataSourcePlugin}. Called once
 * from application boot. The runtime package cannot depend on
 * `public/app/features/plugins`, so the concrete implementation is injected
 * here at startup.
 *
 * @internal
 */
export function setGetDataSourcePlugin(fn: GetDataSourcePluginFn): void {
  getDataSourcePluginFn = fn;
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
  if (!getDataSourcePluginFn) {
    throw new Error(
      'getDataSourcePlugin has not been initialized. Call setGetDataSourcePlugin during application boot.'
    );
  }
  return getDataSourcePluginFn(ref, scopedVars);
}

/**
 * Look up a runtime data source plugin instance by uid. Called by the core
 * implementation of {@link getDataSourcePlugin} before attempting a full
 * plugin load.
 *
 * @internal
 */
export function getRuntimeDataSourcePlugin(uid: string): DataSourceApi | undefined {
  return runtimeByUid[uid];
}

/**
 * Register a runtime data source. Writes to both the instance-settings cache
 * and the runtime-instance map so the data source is available to
 * {@link getInstanceSettings}, {@link findInstanceSettings} and
 * {@link getDataSourcePlugin}.
 *
 * @public
 */
export function registerRuntimeDataSource(entry: RuntimeDataSourceRegistration): void {
  const { dataSource } = entry;

  if (runtimeByUid[dataSource.uid]) {
    throw new Error(`A runtime data source with uid ${dataSource.uid} has already been registered`);
  }

  upsertRuntimeDataSource(dataSource.instanceSettings);
  runtimeByUid[dataSource.uid] = dataSource;
}

/**
 * Test helper — resets all module state. Should only be called from tests.
 *
 * @internal
 */
export function _resetForTests(): void {
  getDataSourcePluginFn = undefined;
  for (const key of Object.keys(runtimeByUid)) {
    delete runtimeByUid[key];
  }
}
