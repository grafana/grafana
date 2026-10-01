import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

import { getCachedPromise, invalidateCachedPromise } from '../../utils/getCachedPromise';

import { notifyDataSourceCacheChanged } from './cacheGeneration';
import { type DataSourceCacheSource, type DataSourceListSnapshot } from './sources/types';

const FILL_CACHE_KEY = 'grafana-runtime:ds-cache-fill';

let source: DataSourceCacheSource | undefined;
let filled = false;
// Bumped by every applied snapshot. A load that started under an older version must not write
// its result into the newer cache.
let snapshotVersion = 0;

// List layer: every data source, keyed three ways. Runtime data sources live in byUid only, so
// list results (which read byName) leave them out, as the legacy DataSourceSrv does.
let byUid = new Map<string, DataSourceInstanceListItem>();
let byName = new Map<string, DataSourceInstanceListItem>();
let byId = new Map<string, DataSourceInstanceListItem>();
let defaultUid: string | undefined;

// Settings layer: full instance settings per uid. Either preloaded by the snapshot or loaded on
// demand through the source.
const settingsByUid = new Map<string, DataSourceInstanceSettings>();

// Runtime data sources survive every fill and reload.
const runtime = new Map<string, DataSourceInstanceSettings>();

export function toListItem(settings: DataSourceInstanceSettings): DataSourceInstanceListItem {
  return {
    uid: settings.uid,
    type: settings.type,
    apiVersion: settings.apiVersion,
    name: settings.name,
    meta: settings.meta,
    isDefault: settings.isDefault ?? false,
  };
}

export function getDataSourceCacheSource(): DataSourceCacheSource | undefined {
  return source;
}

/**
 * Set the source that fills the cache. Also applies its initial snapshot right away when it has
 * one; otherwise starts the first fill without waiting for it.
 */
export function setDataSourceCacheSource(selected: DataSourceCacheSource): void {
  source = selected;
  const initial = selected.getInitialSnapshot();
  if (initial) {
    applySnapshot(initial);
    return;
  }
  awaitFill().catch(() => {
    // The rejection reaches every caller through awaitFill; nothing to do for the boot call.
  });
}

/**
 * Wait until the cache can be read. Resolves at once when it is filled (or when no source was
 * selected, as in tests that seed nothing). Concurrent callers share one in-flight fill, and
 * because a rejected promise is not cached, a call after a failed fill starts a new one.
 */
export function awaitFill(): Promise<void> {
  if (filled || !source) {
    return Promise.resolve();
  }
  const from = source;
  const version = snapshotVersion;

  const fill = async () => {
    try {
      const snapshot = await from.loadList();
      if (version === snapshotVersion) {
        applySnapshot(snapshot);
      }
    } catch (error) {
      // When a newer snapshot filled the cache meanwhile, this failure no longer matters.
      if (version === snapshotVersion) {
        throw error;
      }
    } finally {
      // Settled fills are tracked by `filled`; keep the shared promise cache for in-flight work.
      invalidateCachedPromise(FILL_CACHE_KEY);
    }
  };

  return getCachedPromise(fill, { cacheKey: FILL_CACHE_KEY });
}

export function applySnapshot(snapshot: DataSourceListSnapshot): void {
  byUid = new Map();
  byName = new Map();
  byId = new Map();

  for (const item of snapshot.items) {
    byName.set(item.name, item);
    byUid.set(item.uid, item);
  }
  for (const [id, uid] of Object.entries(snapshot.uidById ?? {})) {
    const item = byUid.get(uid);
    if (item) {
      byId.set(id, item);
    }
  }
  defaultUid = snapshot.defaultUid;

  settingsByUid.clear();
  for (const [uid, settings] of Object.entries(snapshot.settings ?? {})) {
    settingsByUid.set(uid, settings);
  }

  // Re-apply runtime data sources so they survive a refetch.
  for (const settings of runtime.values()) {
    byUid.set(settings.uid, toListItem(settings));
    settingsByUid.set(settings.uid, settings);
  }

  snapshotVersion++;
  filled = true;
  notifyDataSourceCacheChanged();
}

/** List items that take part in list results: everything except runtime data sources. */
export function getNamedListItems(): DataSourceInstanceListItem[] {
  return Array.from(byName.values());
}

export function getListItemByUid(uid: string): DataSourceInstanceListItem | undefined {
  return byUid.get(uid);
}

export function getListItemByName(name: string): DataSourceInstanceListItem | undefined {
  return byName.get(name);
}

export function getListItemById(id: string): DataSourceInstanceListItem | undefined {
  return byId.get(id);
}

export function getDefaultListItem(): DataSourceInstanceListItem | undefined {
  return defaultUid === undefined ? undefined : byUid.get(defaultUid);
}

/**
 * Settings for a uid from the settings layer, loading them through the source on a miss.
 * Concurrent callers for the same uid share one load. Only a defined result is cached, so a
 * miss or a failure is retried on the next call.
 */
export async function loadSettingsCached(uid: string): Promise<DataSourceInstanceSettings | undefined> {
  const cached = settingsByUid.get(uid);
  if (cached) {
    return cached;
  }
  if (!source) {
    return undefined;
  }
  const from = source;
  const version = snapshotVersion;
  // The version is part of the key, so a new snapshot never joins a load for the old one.
  const cacheKey = `grafana-runtime:ds-settings:${version}:${uid}`;

  const load = async () => {
    try {
      const settings = await from.loadSettings(uid);
      if (settings && version === snapshotVersion) {
        settingsByUid.set(uid, settings);
      }
      return settings;
    } finally {
      invalidateCachedPromise(cacheKey);
    }
  };

  return getCachedPromise(load, { cacheKey });
}

export function upsertRuntimeSettings(settings: DataSourceInstanceSettings): void {
  if (runtime.has(settings.uid) || byUid.has(settings.uid)) {
    throw new Error(`A data source with uid ${settings.uid} has already been registered`);
  }
  runtime.set(settings.uid, settings);
  byUid.set(settings.uid, toListItem(settings));
  settingsByUid.set(settings.uid, settings);
}

export function _resetForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTests must only be called from tests');
  }
  invalidateCachedPromise(FILL_CACHE_KEY);
  source = undefined;
  filled = false;
  // Not reset to 0, so settings cache keys from an earlier test can never match.
  snapshotVersion++;
  byUid = new Map();
  byName = new Map();
  byId = new Map();
  defaultUid = undefined;
  settingsByUid.clear();
  runtime.clear();
}
