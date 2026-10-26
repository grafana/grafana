import { type DataSourceApi } from '@grafana/data';

import { type RuntimeDataSource } from '../RuntimeDataSource';

import { PLUGIN_CACHE_UID_MISMATCH_WARNING } from './constants';
import { logDataSourceWarning } from './logging';

const cache = new Map<string, DataSourceApi>();
const runtimeCache = new Map<string, RuntimeDataSource>();

export function getCachedPlugin(uid: string): DataSourceApi | undefined {
  return cache.get(uid);
}

export function setCachedPlugin(uid: string, instance: DataSourceApi): void {
  // An instance whose uid differs from its cache key would be returned with the wrong
  // identity for every future lookup of that key, so surface it while it's still local.
  // An undefined uid is skipped: loaded instances always have one (set by the DataSourceApi
  // constructor or the legacy patching in loadDataSourceInstance), so it indicates a test double.
  if (instance.uid !== undefined && instance.uid !== uid) {
    logDataSourceWarning(PLUGIN_CACHE_UID_MISMATCH_WARNING, { cacheUid: uid, instanceUid: instance.uid });
  }
  cache.set(uid, instance);
}

/** Write a runtime-registered plugin instance. Runtime entries survive {@link clearPluginCache}. */
export function setRuntimePlugin(uid: string, instance: RuntimeDataSource): void {
  runtimeCache.set(uid, instance);
  cache.set(uid, instance);
}

/**
 * Sync because the legacy `DataSourceSrv` reads runtime data sources from here. Remove with `DataSourceSrv`.
 * @internal
 */
export function getRuntimePlugin(uid: string): RuntimeDataSource | undefined {
  return runtimeCache.get(uid);
}

/** Clear all non-runtime plugin instances. Runtime entries are preserved. */
export function clearPluginCache(): void {
  for (const uid of cache.keys()) {
    if (!runtimeCache.has(uid)) {
      cache.delete(uid);
    }
  }
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
  cache.clear();
  runtimeCache.clear();
}
