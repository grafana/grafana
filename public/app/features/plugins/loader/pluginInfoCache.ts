import { PluginLoadingStrategy } from '@grafana/data';

import { clearPluginSettingsCache } from '../pluginSettings';

import { CACHE_INITIALISED_AT, DECOUPLED_PLUGIN_REGEX, PLUGIN_PATH_REGEX } from './constants';

const cache: Record<string, PluginInfo> = {};

type RegisterPluginInfo = {
  path: string;
  version: string;
  loadingStrategy: PluginLoadingStrategy;
};

type PluginInfo = Omit<RegisterPluginInfo, 'path'>;

export function registerPluginInfoInCache({ path, version, loadingStrategy }: RegisterPluginInfo): void {
  const key = extractCacheKeyFromPath(path);

  if (key && !cache[key]) {
    cache[key] = {
      version: encodeURI(version),
      loadingStrategy,
    };
  }
}

export function clearPluginInfoInCache(pluginId: string): void {
  const path = pluginId;
  if (cache[path]) {
    delete cache[path];
  }
  clearPluginSettingsCache(pluginId);
}

export function resolvePluginUrlWithCache(url: string, defaultBust = CACHE_INITIALISED_AT): string {
  const path = getCacheKey(url);
  if (!path) {
    return `${url}?_cache=${defaultBust}`;
  }
  const version = cache[path]?.version;
  const bust = version || defaultBust;
  return `${url}?_cache=${bust}`;
}

export function getPluginInfoFromCache(path: string): PluginInfo | undefined {
  const key = getCacheKey(path);
  if (!key) {
    return;
  }
  return cache[key];
}

export function extractCacheKeyFromPath(path: string): string | null {
  const match = path.match(PLUGIN_PATH_REGEX);

  if (match) {
    return match[1];
  }

  // Decoupled core plugins can be loaded by alternative paths
  const decoupledPluginMatch = path.match(DECOUPLED_PLUGIN_REGEX);

  if (decoupledPluginMatch) {
    return decoupledPluginMatch[1];
  }

  return null;
}

function getCacheKey(path: string): string | undefined {
  const key = Object.keys(cache).find((key) => path.includes(key));
  if (!key) {
    return;
  }
  return key;
}
