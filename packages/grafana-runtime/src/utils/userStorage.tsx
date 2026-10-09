import { get } from 'lodash';
import { useRef } from 'react';
import { lastValueFrom } from 'rxjs';

import { usePluginContext, type UserStorage as UserStorageType, store } from '@grafana/data';

import { config } from '../config';
import { type BackendSrvRequest, getBackendSrv } from '../services';

const baseURL = `/apis/userstorage.grafana.app/v0alpha1/namespaces/${config.namespace}/user-storage`;

// Global cache for user storage initialization requests
// Cache key: resourceName (e.g., "plugin-id:user-uid")
// Cache value: Promise<UserStorageSpec | null> | UserStorageSpec | null
const storageCache = new Map<string, Promise<UserStorageSpec | null> | UserStorageSpec | null>();

// Lock map to serialize operations per resourceName
// Cache key: resourceName
// Cache value: Promise that resolves when the lock is available
const operationLocks = new Map<string, Promise<void>>();

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
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;

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
    return requestOptions.manageError ? requestOptions.manageError(error) : { error };
  }
}

/**
 * A class for interacting with the backend user storage.
 * Exposed internally only to avoid misuse (wrong service name)..
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

  /**
   * Serializes operations on this resourceName: resolves once every earlier holder has released, with
   * the function that releases this hold. A hold never rejects, so a holder whose operation throws
   * still releases from its `finally` and later holders are not stuck.
   */
  private acquireLock(): Promise<() => void> {
    const previous = operationLocks.get(this.resourceName) ?? Promise.resolve();
    let release = () => {};
    const mine = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => mine);
    operationLocks.set(this.resourceName, tail);
    return previous.then(() => () => {
      release();
      if (operationLocks.get(this.resourceName) === tail) {
        operationLocks.delete(this.resourceName);
      }
    });
  }

  /** The stored resource, `null` when none exists yet (404). Throws on any other failure. */
  private async fetchResource(): Promise<UserStorageResource | null> {
    const response = await apiRequest<UserStorageResource>({
      url: `/${this.resourceName}`,
      method: 'GET',
      manageError: (error) => {
        if (get(error, 'status') === 404) {
          return { error: null };
        }
        return { error };
      },
    });
    if ('error' in response) {
      if (response.error === null) {
        return null;
      }
      throw response.error;
    }
    return response.data;
  }

  private async init(): Promise<unknown> {
    // Check global cache first
    const cached = storageCache.get(this.resourceName);
    if (cached !== undefined) {
      if (cached instanceof Promise) {
        // Cache has a promise, await it
        try {
          await cached;
          return;
        } catch (error) {
          // Promise rejected, return error to match original behavior
          return error;
        }
      } else {
        // Cache has a resolved result, already initialized
        return;
      }
    }

    // No cache entry, create the request promise and cache it atomically
    // Use a double-check pattern to handle race conditions
    let requestPromise = storageCache.get(this.resourceName);
    if (requestPromise instanceof Promise) {
      // Another instance created the promise between our check and now, use it
      try {
        await requestPromise;
        return;
      } catch (error) {
        return error;
      }
    }

    // Create new promise
    requestPromise = this.fetchResource().then((resource) => resource?.spec ?? null);

    // Atomically set the promise only if cache is still empty
    const existing = storageCache.get(this.resourceName);
    if (existing === undefined) {
      storageCache.set(this.resourceName, requestPromise);
    } else if (existing instanceof Promise) {
      // Another instance set a promise, use it instead
      requestPromise = existing;
    } else {
      // Another instance already resolved, we're done
      return;
    }

    try {
      const result = await requestPromise;
      // Replace promise with resolved result in cache
      storageCache.set(this.resourceName, result);
    } catch (error) {
      // Remove failed promise from cache so it can be retried
      storageCache.delete(this.resourceName);
      return error;
    }
    return;
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      return store.get(`${this.resourceName}:${key}`) ?? null;
    }

    // Acquire lock to serialize operations
    const releaseLock = await this.acquireLock();
    try {
      // Ensure storage is initialized
      await this.init();
      const storageSpec = storageCache.get(this.resourceName);
      if (!storageSpec) {
        // Storage doesn't exist or still loading, fallback to localStorage
        return store.get(`${this.resourceName}:${key}`) ?? null;
      }
      if (storageSpec instanceof Promise) {
        const result = await storageSpec;
        return result?.data[key] ?? null;
      }
      return storageSpec.data[key] ?? null;
    } finally {
      releaseLock();
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      store.set(`${this.resourceName}:${key}`, value);
      return;
    }

    // Acquire lock to serialize operations
    const releaseLock = await this.acquireLock();
    try {
      const newData = { data: { [key]: value } };
      // Ensure storage is initialized
      const error = await this.init();
      if (error) {
        // Fallback to localStorage
        store.set(`${this.resourceName}:${key}`, value);
        return;
      }

      let storageSpec = storageCache.get(this.resourceName);
      if (storageSpec instanceof Promise) {
        storageSpec = await storageSpec;
      }
      if (!storageSpec) {
        // No user storage found, create a new one
        const createResult = await apiRequest<UserStorageSpec>({
          url: `/`,
          method: 'POST',
          body: {
            metadata: { name: this.resourceName, labels: { user: this.userUID, service: this.service } },
            spec: newData,
          },
          manageError: (error) => {
            // Fallback to localStorage
            store.set(`${this.resourceName}:${key}`, value);
            return { error };
          },
        });
        if ('error' in createResult && createResult.error) {
          // Error occurred, fallback already handled in manageError
          return;
        }
        // Update global cache with the new storage
        storageCache.set(this.resourceName, newData);
        return;
      }

      // Clone the storage spec to avoid mutating the cached object directly
      // This prevents race conditions where multiple setItem calls modify the same object
      const updatedSpec: UserStorageSpec = {
        data: { ...storageSpec.data, [key]: value },
      };

      const updateResult = await apiRequest<UserStorageSpec>({
        headers: { 'Content-Type': 'application/merge-patch+json' },
        url: `/${this.resourceName}`,
        method: 'PATCH',
        body: { spec: newData },
        manageError: (error) => {
          // Fallback to localStorage
          store.set(`${this.resourceName}:${key}`, value);
          return { error };
        },
      });
      if ('error' in updateResult && updateResult.error) {
        // Error occurred, fallback already handled in manageError
        return;
      }
      // Update global cache with the modified storage (using cloned object)
      storageCache.set(this.resourceName, updatedSpec);
    } finally {
      releaseLock();
    }
  }

  /**
   * Read-modify-write of one item against what is stored right now. `update` gets the stored value
   * (`null` when there is none) and returns the value to store, or `undefined` to store nothing.
   * Signed in: fetches the resource fresh, writes with its `metadata.resourceVersion` so the server
   * rejects a write over a copy it has not seen, and on that rejection re-reads and re-runs `update`
   * (three attempts). Rejects when a request fails; nothing is written to localStorage.
   * Signed out: localStorage, read and written in one synchronous step, so tabs cannot interleave.
   */
  async updateItem(key: string, update: (current: string | null) => string | undefined): Promise<void> {
    if (!this.canUseUserStorage) {
      const storeKey = `${this.resourceName}:${key}`;
      const next = update(store.get(storeKey) ?? null);
      if (next !== undefined) {
        store.set(storeKey, next);
      }
      return;
    }

    const releaseLock = await this.acquireLock();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const resource = await this.fetchResource();
        const next = update(resource?.spec.data[key] ?? null);
        if (next === undefined) {
          storageCache.set(this.resourceName, resource?.spec ?? null);
          return;
        }
        const result = resource
          ? await apiRequest<UserStorageResource>({
              headers: { 'Content-Type': 'application/merge-patch+json' },
              url: `/${this.resourceName}`,
              method: 'PATCH',
              body: {
                metadata: { resourceVersion: resource.metadata.resourceVersion },
                spec: { data: { [key]: next } },
              },
            })
          : await apiRequest<UserStorageResource>({
              url: `/`,
              method: 'POST',
              body: {
                metadata: { name: this.resourceName, labels: { user: this.userUID, service: this.service } },
                spec: { data: { [key]: next } },
              },
            });
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
    } finally {
      releaseLock();
    }
  }

  async deleteItem(key: string): Promise<void> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      store.delete(`${this.resourceName}:${key}`);
      return;
    }

    // Acquire lock to serialize operations
    const releaseLock = await this.acquireLock();
    try {
      // Ensure storage is initialized
      const error = await this.init();
      if (error) {
        // Fallback to localStorage
        store.delete(`${this.resourceName}:${key}`);
        return;
      }

      let storageSpec = storageCache.get(this.resourceName);
      if (storageSpec instanceof Promise) {
        storageSpec = await storageSpec;
      }
      if (!storageSpec) {
        // Storage doesn't exist, nothing to delete
        store.delete(`${this.resourceName}:${key}`);
        return;
      }

      // Clone the storage spec to avoid mutating the cached object directly
      const updatedData = { ...storageSpec.data };
      delete updatedData[key];
      const updatedSpec: UserStorageSpec = { data: updatedData };

      const deleteResult = await apiRequest<UserStorageSpec>({
        headers: { 'Content-Type': 'application/merge-patch+json' },
        url: `/${this.resourceName}`,
        method: 'PATCH',
        body: { spec: { data: { [key]: null } } },
        manageError: (error) => {
          // Fallback to localStorage
          store.delete(`${this.resourceName}:${key}`);
          return { error };
        },
      });
      if ('error' in deleteResult && deleteResult.error) {
        // Error occurred, fallback already handled in manageError
        return;
      }
      // Update global cache with the modified storage (using cloned object)
      storageCache.set(this.resourceName, updatedSpec);
    } finally {
      releaseLock();
    }
  }

  async allItems(): Promise<Record<string, string>> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      return store.all(`${this.resourceName}:`);
    }

    // Acquire lock to serialize operations
    const releaseLock = await this.acquireLock();
    try {
      // Ensure storage is initialized
      await this.init();
      let storageSpec = storageCache.get(this.resourceName);
      if (storageSpec instanceof Promise) {
        storageSpec = await storageSpec;
      }
      if (!storageSpec) {
        // Storage doesn't exist, fallback to localStorage
        return store.all(`${this.resourceName}:`);
      }
      return { ...storageSpec.data };
    } finally {
      releaseLock();
    }
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
