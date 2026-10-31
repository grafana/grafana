import { get, noop } from 'lodash';
import { useRef } from 'react';
import { lastValueFrom } from 'rxjs';

import { usePluginContext, type UserStorage as UserStorageType, store } from '@grafana/data';

import { config } from '../config';
import { type BackendSrvRequest, getBackendSrv } from '../services';

const baseURL = `/apis/userstorage.grafana.app/v0alpha1/namespaces/${config.namespace}/user-storage`;

// Per resourceName (e.g. "plugin-id:user-uid"): the spec, or `null` once a GET returned 404.
// Only touched under the operation lock, so it never has to hold a pending load.
const storageCache = new Map<string, UserStorageSpec | null>();

// Per resourceName: settles once the last queued operation has finished.
const operationLocks = new Map<string, Promise<void>>();

// Each attempt costs one GET and one write; this bounds the cost of a key many tabs fight over.
const WRITE_ATTEMPTS = 3;

/**
 * Clears the global storage cache. Used for testing purposes.
 * @internal
 */
export function _clearStorageCache() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('clearStorageCache() function can only be called from tests.');
  }
  storageCache.clear();
  operationLocks.clear();
}

interface RequestOptions extends BackendSrvRequest {
  // rtk codegen sets this
  body?: BackendSrvRequest['data'];
}

type UserStorageSpec = {
  data: { [key: string]: string };
};

type UserStorageResource = {
  metadata: { resourceVersion: string };
  spec: UserStorageSpec;
};

async function apiRequest<T>(requestOptions: RequestOptions) {
  try {
    const { data: responseData, ...meta } = await lastValueFrom(
      getBackendSrv().fetch<T>({
        ...requestOptions,
        url: baseURL + requestOptions.url,
        data: requestOptions.body,
        showErrorAlert: false,
      })
    );
    return { data: responseData, meta };
  } catch (error) {
    return { error };
  }
}

export interface ScopedUserStorageOptions {
  /** Move matching keys from the plugin's default record, keeping existing scoped values. */
  migrateKeyPrefixes?: readonly string[];
  /** Remove only empty legacy keys matching these prefixes, in the same conditional write. */
  removeEmptyKeyPrefixes?: readonly string[];
}

/**
 * A class for interacting with the backend user storage.
 * Exposed internally only to avoid misuse (wrong service name).
 *
 * Two failure policies coexist on purpose. `getItem`, `setItem`, `deleteItem` and `allItems` fall back to
 * localStorage when a request fails, so a plugin keeps working. `updateItem` rejects instead: its callers
 * merge against the stored copy, and a merge over a copy the server never saw is worse than no write.
 */

export class UserStorage implements UserStorageType {
  private service: string;
  private resourceName: string;
  private userUID: string;
  private canUseUserStorage: boolean;
  private scopes = new Map<string, { storage: UserStorage; options: string }>();
  private migration?: { source: UserStorage; options: ScopedUserStorageOptions };

  /**
   * Use a fixed feature name, never a page, user or other unbounded identifier:
   * the service name is also a storage metric label. Identity remains the current user.
   * Migration rejects on failure rather than treating browser fallback as a confirmed copy.
   */
  getScopedStorage(scope: string, options: ScopedUserStorageOptions = {}): UserStorageType {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(scope)) {
      throw new Error('User storage scope must be 1–64 lowercase letters, digits or hyphens, starting with a letter');
    }
    if ([...(options.migrateKeyPrefixes ?? []), ...(options.removeEmptyKeyPrefixes ?? [])].some((prefix) => !prefix)) {
      throw new Error('User storage migration prefixes must not be empty');
    }
    const optionKey = JSON.stringify({
      migrateKeyPrefixes: options.migrateKeyPrefixes ?? [],
      removeEmptyKeyPrefixes: options.removeEmptyKeyPrefixes ?? [],
    });
    const previous = this.scopes.get(scope);
    if (previous) {
      if (previous.options !== optionKey) {
        throw new Error('User storage migration options must stay the same for a scope');
      }
      return previous.storage;
    }
    const scoped = new UserStorage(`${this.service}.${scope}`);
    if (options.migrateKeyPrefixes?.length || options.removeEmptyKeyPrefixes?.length) {
      scoped.migration = {
        source: this,
        options: {
          migrateKeyPrefixes: [...(options.migrateKeyPrefixes ?? [])],
          removeEmptyKeyPrefixes: [...(options.removeEmptyKeyPrefixes ?? [])],
        },
      };
    }
    this.scopes.set(scope, { storage: scoped, options: optionKey });
    return scoped;
  }

  private finishMigration(): void {
    const migration = this.migration;
    if (!migration) {
      return;
    }
    // Preserve browser fallback data as well, including signed-in saves made
    // while the server was unavailable. Never upload it over server values.
    const { source, options } = migration;
    for (const [key, value] of Object.entries(store.all(`${source.resourceName}:`))) {
      if (options.migrateKeyPrefixes?.some((prefix) => key.startsWith(prefix))) {
        const current = store.get(this.localKey(key));
        if (current == null) {
          store.set(this.localKey(key), value);
          store.delete(source.localKey(key));
        } else if (current === value) {
          store.delete(source.localKey(key));
        }
      } else if (value === '' && options.removeEmptyKeyPrefixes?.some((prefix) => key.startsWith(prefix))) {
        store.delete(source.localKey(key));
      }
    }
    this.migration = undefined;
  }

  private async migrateLegacyStorage(): Promise<void> {
    const migration = this.migration;
    if (!migration) {
      return;
    }
    const { source, options } = migration;
    const shouldMove = (key: string) => options.migrateKeyPrefixes?.some((prefix) => key.startsWith(prefix));
    const shouldRemove = (key: string, value: string) =>
      value === '' && options.removeEmptyKeyPrefixes?.some((prefix) => key.startsWith(prefix));
    if (!this.canUseUserStorage) {
      this.finishMigration();
      return;
    }

    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
      const legacy = await source.fetchResource();
      if (!legacy) {
        this.finishMigration();
        return;
      }
      const candidates = Object.entries(legacy.spec.data).filter(
        ([key, value]) => shouldMove(key) || shouldRemove(key, value)
      );
      if (candidates.length === 0) {
        this.finishMigration();
        return;
      }
      if (!legacy.metadata.resourceVersion) {
        throw new Error('User storage migration requires a source resource version');
      }
      const target = await this.fetchResource();
      storageCache.set(this.resourceName, target?.spec ?? null);
      const copied = Object.fromEntries(
        Object.entries(legacy.spec.data).filter(
          ([key]) => shouldMove(key) && !Object.hasOwn(target?.spec.data ?? {}, key)
        )
      );
      if (Object.keys(copied).length > 0) {
        if (target && !target.metadata.resourceVersion) {
          throw new Error('User storage migration requires a target resource version');
        }
        const write = target
          ? await this.patchResource({
              metadata: { resourceVersion: target.metadata.resourceVersion },
              spec: { data: copied },
            })
          : await this.createResource(copied);
        if ('error' in write) {
          if (get(write.error, 'status') === 409) {
            continue;
          }
          throw write.error;
        }
        storageCache.delete(this.resourceName);
      }
      const removed = Object.fromEntries(
        candidates
          .filter(([key, value]) =>
            shouldMove(key)
              ? (Object.hasOwn(copied, key) ? copied[key] : target?.spec.data[key]) === value
              : shouldRemove(key, value)
          )
          .map(([key]) => [key, null])
      );
      if (Object.keys(removed).length === 0) {
        // A newer scoped value wins, but retain a differing legacy value rather
        // than erasing a concurrent old client's edit that was never copied.
        this.finishMigration();
        return;
      }
      // Never erase a source that changed while copying, or use local fallback
      // as evidence of a durable target. A retry keeps newer target values.
      const cleanup = await source.patchResource({
        metadata: { resourceVersion: legacy.metadata.resourceVersion },
        spec: { data: removed },
      });
      if ('error' in cleanup) {
        if (get(cleanup.error, 'status') === 409) {
          continue;
        }
        throw cleanup.error;
      }
      storageCache.delete(source.resourceName);
      this.finishMigration();
      return;
    }
    throw new Error('User storage migration conflicted with another writer; try again');
  }

  constructor(service: string) {
    this.service = service;
    this.userUID = config.bootData.user.uid === '' ? config.bootData.user.id.toString() : config.bootData.user.uid;
    this.resourceName = `${service}:${this.userUID}`;
    this.canUseUserStorage = config.bootData.user.isSignedIn;
  }

  private localKey(key: string) {
    return `${this.resourceName}:${key}`;
  }

  /** Runs `operation` once every earlier operation on this resourceName has settled, whether it succeeded or threw. */
  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = operationLocks.get(this.resourceName) ?? Promise.resolve();
    const result = previous.then(async () => {
      await this.migrateLegacyStorage();
      return operation();
    });
    const tail = result.then(noop, noop);
    operationLocks.set(this.resourceName, tail);
    tail.then(() => {
      if (operationLocks.get(this.resourceName) === tail) {
        operationLocks.delete(this.resourceName);
      }
    });
    return result;
  }

  /** The stored resource, `null` when none exists yet (404). Throws on any other failure. */
  private async fetchResource(): Promise<UserStorageResource | null> {
    const response = await apiRequest<UserStorageResource>({ url: `/${this.resourceName}`, method: 'GET' });
    if ('error' in response) {
      if (get(response.error, 'status') === 404) {
        return null;
      }
      throw response.error;
    }
    return response.data;
  }

  private createResource(data: UserStorageSpec['data']) {
    return apiRequest<UserStorageResource>({
      url: `/`,
      method: 'POST',
      body: {
        metadata: { name: this.resourceName, labels: { user: this.userUID, service: this.service } },
        spec: { data },
      },
    });
  }

  /** Merge-patch; a `null` value deletes that key. With `metadata.resourceVersion` the server rejects a stale write. */
  private patchResource(body: {
    metadata?: { resourceVersion: string };
    spec: { data: Record<string, string | null> };
  }) {
    return apiRequest<UserStorageResource>({
      headers: { 'Content-Type': 'application/merge-patch+json' },
      url: `/${this.resourceName}`,
      method: 'PATCH',
      body,
    });
  }

  /** Fills the cache on first use. Runs under the lock, so nothing reads the cache mid-load. Returns the load error, if any. */
  private async init(): Promise<unknown> {
    if (storageCache.has(this.resourceName)) {
      return;
    }
    try {
      storageCache.set(this.resourceName, (await this.fetchResource())?.spec ?? null);
    } catch (error) {
      return error;
    }
    return;
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.canUseUserStorage) {
      await this.migrateLegacyStorage();
      return store.get(this.localKey(key)) ?? null;
    }
    return this.runExclusive(async () => {
      await this.init();
      const spec = storageCache.get(this.resourceName);
      if (!spec) {
        // No resource yet, or the load failed: fall back to localStorage
        return store.get(this.localKey(key)) ?? null;
      }
      return spec.data[key] ?? null;
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.canUseUserStorage) {
      await this.migrateLegacyStorage();
      store.set(this.localKey(key), value);
      return;
    }
    return this.runExclusive(async () => {
      const error = await this.init();
      if (error) {
        store.set(this.localKey(key), value);
        return;
      }
      const spec = storageCache.get(this.resourceName);
      const result = spec
        ? await this.patchResource({ spec: { data: { [key]: value } } })
        : await this.createResource({ [key]: value });
      if ('error' in result) {
        store.set(this.localKey(key), value);
        return;
      }
      storageCache.set(this.resourceName, { data: { ...spec?.data, [key]: value } });
    });
  }

  /**
   * Read-modify-write of one item against what is stored right now. `update` gets the stored value
   * (`null` when there is none) and returns the value to store, or `undefined` to store nothing.
   * Signed in: fetches the resource fresh, writes with its `metadata.resourceVersion` so the server
   * rejects a write over a copy it has not seen, and on that rejection re-reads and re-runs `update`
   * (`WRITE_ATTEMPTS` times). Every snapshot it fetches refreshes the cache, so a later `getItem` sees the
   * fresh value even when the write fails. Rejects when a request fails; nothing is written to localStorage.
   * Signed out: localStorage. There is no cross-tab lock, so two tabs updating at the same instant can drop
   * one update; the next update merges from storage again.
   */
  async updateItem(key: string, update: (current: string | null) => string | undefined): Promise<void> {
    if (!this.canUseUserStorage) {
      await this.migrateLegacyStorage();
      const next = update(store.get(this.localKey(key)) ?? null);
      if (next !== undefined) {
        store.set(this.localKey(key), next);
      }
      return;
    }
    return this.runExclusive(async () => {
      for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
        const resource = await this.fetchResource();
        storageCache.set(this.resourceName, resource?.spec ?? null);
        const next = update(resource?.spec.data[key] ?? null);
        if (next === undefined) {
          return;
        }
        const result = resource
          ? await this.patchResource({
              metadata: { resourceVersion: resource.metadata.resourceVersion },
              spec: { data: { [key]: next } },
            })
          : await this.createResource({ [key]: next });
        if ('error' in result) {
          // Stale version, or another client created the resource first: re-read and run `update` again.
          if (get(result.error, 'status') === 409) {
            continue;
          }
          throw result.error;
        }
        storageCache.set(this.resourceName, { data: { ...resource?.spec.data, [key]: next } });
        return;
      }
      throw new Error('User storage: conflicting writes');
    });
  }

  async deleteItem(key: string): Promise<void> {
    if (!this.canUseUserStorage) {
      await this.migrateLegacyStorage();
      store.delete(this.localKey(key));
      return;
    }
    return this.runExclusive(async () => {
      const error = await this.init();
      const spec = storageCache.get(this.resourceName);
      if (error || !spec) {
        // Nothing to delete server-side (load failed or no resource); clear the localStorage fallback instead
        store.delete(this.localKey(key));
        return;
      }
      const result = await this.patchResource({ spec: { data: { [key]: null } } });
      if ('error' in result) {
        store.delete(this.localKey(key));
        return;
      }
      const { [key]: _, ...data } = spec.data;
      storageCache.set(this.resourceName, { data });
    });
  }

  async allItems(): Promise<Record<string, string>> {
    if (!this.canUseUserStorage) {
      await this.migrateLegacyStorage();
      return store.all(`${this.resourceName}:`);
    }
    return this.runExclusive(async () => {
      await this.init();
      const spec = storageCache.get(this.resourceName);
      return spec ? { ...spec.data } : store.all(`${this.resourceName}:`);
    });
  }
}

// This is a type alias to avoid breaking changes
export interface PluginUserStorage extends UserStorageType {
  /** Separate fixed feature storage from the default plugin record, optionally migrating legacy keys. */
  getScopedStorage(scope: string, options?: ScopedUserStorageOptions): UserStorageType;
}

/**
 * A hook for interacting with the backend user storage (or local storage if not enabled).
 * @returns An scoped object for a plugin and a user with getItem and setItem functions.
 * @alpha Experimental
 */
export function usePluginUserStorage(): PluginUserStorage {
  const context = usePluginContext();
  const ref = useRef<[id: string, PluginUserStorage] | undefined>(undefined);

  if (!context) {
    throw new Error(`No PluginContext found. The usePluginUserStorage() hook can only be used from a plugin.`);
  }

  if (!ref.current || ref.current[0] !== context.meta.id) {
    ref.current = [context.meta.id, new UserStorage(context.meta.id)];
  }

  return ref.current[1];
}

/**
 * Internal Grafana-core only interface for constructing a UserStorage instance in a
 * react component.
 */
export function useUserStorage(service: string): UserStorageType {
  const ref = useRef<[service: string, UserStorageType] | undefined>(undefined);

  if (!ref.current || ref.current[0] !== service) {
    ref.current = [service, new UserStorage(service)];
  }

  return ref.current[1];
}
