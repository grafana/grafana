import { PluginLoadingStrategy } from '@grafana/data';

import { clearPluginSettingsCache } from '../pluginSettings';

import { CACHE_INITIALISED_AT } from './constants';

const cache: Record<string, CachedPlugin> = {};

type CacheablePlugin = {
  path: string;
  version: string;
  loadingStrategy: PluginLoadingStrategy;
};

type CachedPlugin = Omit<CacheablePlugin, 'path'>;

export function registerPluginInCache({ path, version, loadingStrategy }: CacheablePlugin): void {
  const key = extractCacheKeyFromPath(path);

  if (key && !cache[key]) {
    cache[key] = {
      version: encodeURI(version),
      loadingStrategy,
    };
  }
}

export function invalidatePluginInCache(pluginId: string): void {
  const path = pluginId;
  if (cache[path]) {
    delete cache[path];
  }
  clearPluginSettingsCache(pluginId);
}

export function resolveWithCache(url: string, defaultBust = CACHE_INITIALISED_AT): string {
  const path = getCacheKey(url);
  if (!path) {
    return `${url}?_cache=${defaultBust}`;
  }
  const version = cache[path]?.version;
  const bust = version || defaultBust;
  return `${url}?_cache=${bust}`;
}

export function getPluginFromCache(path: string): CachedPlugin | undefined {
  const key = getCacheKey(path);
  if (!key) {
    return;
  }
  return cache[key];
}

export function extractCacheKeyFromPath(path: string) {
  const regex = /\/?public\/plugins\/([^\/]+)\//;
  const match = path.match(regex);

  if (match) {
    return match[1];
  }

  // Decoupled core plugins can be loaded by alternative paths
  const decoupledPluginRegex = /\/?public\/app\/plugins\/(?:datasource|panel)\/([^\/]+)\//;
  const decoupledPluginMatch = path.match(decoupledPluginRegex);

  if (decoupledPluginMatch) {
    return decoupledPluginMatch[1];
  }

  return null;
}

function getCacheKey(address: string): string | undefined {
  const key = Object.keys(cache).find((key) => address.includes(key));
  if (!key) {
    return;
  }
  return key;
}
