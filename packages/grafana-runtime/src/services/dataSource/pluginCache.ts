import { type DataSourceApi } from '@grafana/data';

const cache: Record<string, DataSourceApi> = {};
const runtimeCache: Record<string, DataSourceApi> = {};

export function getCachedPlugin(uid: string): DataSourceApi | undefined {
  return cache[uid];
}

export function setCachedPlugin(uid: string, instance: DataSourceApi): void {
  cache[uid] = instance;
}

/** Write a runtime-registered plugin instance. Runtime entries survive {@link clearPluginCache}. */
export function setRuntimePlugin(uid: string, instance: DataSourceApi): void {
  runtimeCache[uid] = instance;
  cache[uid] = instance;
}

/**
 * Clear all non-runtime plugin instances. Runtime entries are preserved,
 * matching the behaviour of the legacy `DatasourceSrv.init()` which reset
 * `this.datasources` then re-added runtime sources.
 */
export function clearPluginCache(): void {
  for (const uid of Object.keys(cache)) {
    if (!runtimeCache[uid]) {
      delete cache[uid];
    }
  }
}

/**
 * Test helper — resets all module state. Should only be called from tests.
 *
 * @internal
 */
export function _resetForTests(): void {
  for (const key of Object.keys(cache)) {
    delete cache[key];
  }
  for (const key of Object.keys(runtimeCache)) {
    delete runtimeCache[key];
  }
}
