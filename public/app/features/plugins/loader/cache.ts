import { clearPluginSettingsCache } from '../pluginSettings';

import { CACHE_INITIALISED_AT } from './constants';

const cache: Record<string, CacheablePlugin> = {};

type CacheablePlugin = {
  pluginId: string;
  version: string;
  isAngular?: boolean;
};

export function registerPluginInCache({ pluginId, version, isAngular }: CacheablePlugin): void {
  const key = pluginId;
  if (key && !cache[key]) {
    cache[key] = {
      version: encodeURI(version),
      isAngular,
      pluginId,
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

export function getPluginFromCache(path: string): CacheablePlugin | undefined {
  const key = getCacheKey(path);
  if (!key) {
    return;
  }
  return cache[key];
}

function getCacheKey(address: string): string | undefined {
  const key = Object.keys(cache).find((key) => address.includes(key));
  if (!key) {
    return;
  }
  return key;
}
