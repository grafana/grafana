import { type PluginLoadingStrategy } from '@grafana/data';
import { invalidatePluginSettingsCache } from '@grafana/runtime/internal';

import { CACHE_INITIALISED_AT, DECOUPLED_PLUGIN_REGEX, PLUGIN_PATH_REGEX } from './constants';

const cache: Record<string, PluginInfo> = {};

type RegisterPluginInfo = {
  path: string;
  // Optional: a plugin may be pinned by buildHash alone (no info.version). When absent,
  // legacy timestamp cache-busting uses the default bust value.
  version?: string;
  loadingStrategy: PluginLoadingStrategy;
  // Content-addressed build identifier for the plugin (F1-T3 build-addressed route).
  // When present, filesystem asset URLs are pinned to /public/plugins/:id/:buildHash/*
  // so a client loads one coherent build across a session (FR-001, FR-002).
  buildHash?: string;
};

type PluginInfo = Omit<RegisterPluginInfo, 'path'>;

export function registerPluginInfoInCache({ path, version, loadingStrategy, buildHash }: RegisterPluginInfo): void {
  const key = extractCacheKeyFromPath(path);

  if (key && !cache[key]) {
    cache[key] = {
      version: version ? encodeURI(version) : undefined,
      loadingStrategy,
      buildHash,
    };
  }
}

export function clearPluginInfoInCache(pluginId: string): void {
  const path = pluginId;
  if (cache[path]) {
    delete cache[path];
  }
  invalidatePluginSettingsCache(pluginId);
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

// Pins a filesystem plugin asset URL to the build-addressed route
// /public/plugins/:id/:buildHash/* (F1-T3). Using the plugin's buildHash instead of a
// per-request timestamp guarantees a client loads one coherent build across a session,
// making version skew across replicas harmless (FR-001, FR-002).
//
// When no buildHash is known for the plugin (mixed-version safety during rollout, or an
// unregistered/legacy plugin), it falls back to the legacy timestamp/version cache-busting.
export function resolvePluginUrlWithBuildHash(url: string): string {
  const path = getCacheKey(url);
  const buildHash = path ? cache[path]?.buildHash : undefined;

  if (buildHash) {
    // Idempotent: a lazy chunk is resolved relative to the already build-addressed
    // module URL, so it already contains /<buildHash>/. Re-inserting it would produce
    // /public/plugins/:id/<hash>/<hash>/chunk.js (a 404). Only insert when absent.
    if (url.includes(`/${buildHash}/`)) {
      return url;
    }

    const pinned = url.replace(PLUGIN_PATH_REGEX, (match) => `${match}${buildHash}/`);
    // Pin only when the URL is actually a /public/plugins/ asset. If the replace did not
    // apply — e.g. a decoupled core plugin served from /public/app/plugins/ — fall through
    // to legacy cache-busting so the URL never loses its ?_cache= param.
    if (pinned !== url) {
      return pinned;
    }
  }

  // No buildHash known (mixed-version rollout / legacy plugin), or the URL is not a
  // build-addressable /public/plugins/ asset: use legacy timestamp/version cache-busting.
  return resolvePluginUrlWithCache(url);
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
  // Callers pass either a bare plugin ID (an exact cache key) or a full asset path/URL.
  if (cache[path]) {
    return path;
  }
  // Resolve by the plugin ID captured from the path, not a substring match: a registered
  // id that is a substring/prefix of another (e.g. `graf` inside `graf-panel`) would
  // otherwise supply the wrong entry — harmless for the legacy `?_cache=` string, but with
  // build-addressing it would rewrite the URL onto another plugin's build and 404.
  const key = extractCacheKeyFromPath(path);
  if (key && cache[key]) {
    return key;
  }
  return undefined;
}
