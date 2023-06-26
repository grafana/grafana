import { clearPluginSettingsCache } from '../pluginSettings';

const cache: Record<string, string> = {};
const initializedAt: number = Date.now();

type CacheablePlugin = {
  path: string;
  version: string;
};

export function registerPluginInCache({ path, version }: CacheablePlugin): void {
  const key = extractPath(path);
  if (key && !cache[key]) {
    cache[key] = encodeURI(version);
  }
}

export function invalidatePluginInCache(pluginId: string): void {
  const path = `plugins/${pluginId}/module`;
  if (cache[path]) {
    delete cache[path];
  }
  clearPluginSettingsCache(pluginId);
}

export function locateWithCache(url: string, defaultBust = initializedAt): string {
  const path = extractPath(url);
  if (!path) {
    return `${url}?_cache=${defaultBust}`;
  }

  const version = cache[path];
  const bust = version || defaultBust;
  return `${url}?_cache=${bust}`;
}

function extractPath(address: string): string | undefined {
  const match = /\/.+\/(plugins\/.+\/module)\.js/i.exec(address);
  if (!match) {
    return;
  }
  const [_, path] = match;
  if (!path) {
    return;
  }
  return path;
}
