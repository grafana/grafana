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
    const result = previous.then(operation);
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
export interface PluginUserStorage extends UserStorageType {}

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
