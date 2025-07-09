// ask the SystemJS registry first
// ask the internal cache secondly

import { GrafanaPlugin, GrafanaPlugin, PluginLoadingStrategy, PluginMeta } from '@grafana/data';

import { resolveModulePath } from './utils';

// lookup if plugin is in cache
// register plugin to cache
// invalidate cache for plugin

type CacheablePlugin = {
  path: string;
  // version: string;
  // loadingStrategy: PluginLoadingStrategy;
  url: string;
  loaded: boolean;
};

interface CachedResult<T extends GrafanaPlugin> {
  plugin: T;
  version: string;
  loadingStrategy: PluginLoadingStrategy;
}

const cache: Map<string, CacheablePlugin>;

export const has = (plugin: PluginMeta): boolean => {
  const modulePath = resolveModulePath(plugin.module);
  const resolvedUrl = System.resolve(modulePath);

  return System.has(resolvedUrl);
};

export const get = async <T extends GrafanaPlugin>(plugin: PluginMeta): Promise<CachedResult<T> | undefined> => {
  const cachedPlugin = cache.get(plugin.id);
  const loading = !cachedPlugin?.loaded;

  if (!has(plugin)) {
    return;
  }
};
