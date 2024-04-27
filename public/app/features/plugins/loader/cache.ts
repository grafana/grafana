import { clearPluginSettingsCache } from '../pluginSettings';

const cache: Record<string, CacheablePlugin> = {};
const initializedAt: number = Date.now();

type CacheablePlugin = {
  path: string;
  version: string;
  isAngular?: boolean;
};

export function registerPluginInCache({ path, version, isAngular }: CacheablePlugin): void {
  const key = extractPath(path);
  if (key && !cache[key]) {
    cache[key] = {
      version: encodeURI(version),
      isAngular,
      path,
    };
  }
}

export function invalidatePluginInCache(pluginId: string): void {
  const path = `plugins/${pluginId}/module`;
  if (cache[path]) {
    delete cache[path];
  }
  clearPluginSettingsCache(pluginId);
}

export function resolveWithCache(url: string, defaultBust = initializedAt): string {
  const path = extractPath(url);
  if (!path) {
    return `${url}?_cache=${defaultBust}`;
  }
  const version = cache[path]?.version;
  const bust = version || defaultBust;
  return `${url}?_cache=${bust}`;
}

export function getPluginFromCache(path: string): CacheablePlugin | undefined {
  const key = extractPath(path);
  if (!key) {
    return;
  }
  return cache[key];
}

function extractPath(address: string): string | undefined {
  const match = /\/?.+\/(plugins\/.+\/module)\.js/i.exec(address);
  if (!match) {
    return;
  }
  const [_, path] = match;
  if (!path) {
    return;
  }
  return path;
}
