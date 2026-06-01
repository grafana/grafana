import { type DataSourceApi } from '@grafana/data';

const cache = new Map<string, DataSourceApi>();
const runtimeCache = new Map<string, DataSourceApi>();

export function getCachedPlugin(uid: string): DataSourceApi | undefined {
  return cache.get(uid);
}

export function setCachedPlugin(uid: string, instance: DataSourceApi): void {
  cache.set(uid, instance);
}

/** Write a runtime-registered plugin instance. Runtime entries survive {@link clearPluginCache}. */
export function setRuntimePlugin(uid: string, instance: DataSourceApi): void {
  runtimeCache.set(uid, instance);
  cache.set(uid, instance);
}

/**
 * Clear all non-runtime plugin instances. Runtime entries are preserved,
 * matching the behaviour of the legacy `DatasourceSrv.init()` which reset
 * `this.datasources` then re-added runtime sources.
 */
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
