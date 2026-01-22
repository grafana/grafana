import { get } from 'lodash';
import { lastValueFrom } from 'rxjs';

import { usePluginContext, type UserStorage as UserStorageType, store } from '@grafana/data';

import { config } from '../config';
import { BackendSrvRequest, getBackendSrv } from '../services';

const baseURL = `/apis/userstorage.grafana.app/v0alpha1/namespaces/${config.namespace}/user-storage`;

// Global cache for user storage initialization requests
// Cache key: resourceName (e.g., "plugin-id:user-uid")
// Cache value: Promise<UserStorageSpec | null> | UserStorageSpec | null
const storageCache = new Map<string, Promise<UserStorageSpec | null> | UserStorageSpec | null>();

// Lock map to serialize setItem operations per resourceName
// Cache key: resourceName
// Cache value: Promise that resolves when the lock is available
const setItemLocks = new Map<string, Promise<void>>();

/**
 * Clears the global storage cache. Used for testing purposes.
 * @internal
 */
export function clearStorageCache() {
  storageCache.clear();
  setItemLocks.clear();
}

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;

  // rtk codegen sets this
  body?: BackendSrvRequest['data'];
}

export type UserStorageSpec = {
  data: { [key: string]: string };
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
    requestPromise = (async (): Promise<UserStorageSpec | null> => {
      const userStorage = await apiRequest<{ spec: UserStorageSpec }>({
        url: `/${this.resourceName}`,
        method: 'GET',
        manageError: (error) => {
          if (get(error, 'status') === 404) {
            return { error: null };
          }
          return { error };
        },
      });
      if ('error' in userStorage) {
        if (userStorage.error === null) {
          // 404 - storage doesn't exist
          return null;
        }
        // Other error, throw so it can be caught and returned
        throw userStorage.error;
      }
      return userStorage.data.spec;
    })();

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
    // Ensure storage is initialized
    await this.init();
    const storageSpec = storageCache.get(this.resourceName);
    if (!storageSpec || storageSpec instanceof Promise) {
      // Storage doesn't exist or still loading, fallback to localStorage
      return store.get(`${this.resourceName}:${key}`) ?? null;
    }
    return storageSpec.data[key];
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      store.set(`${this.resourceName}:${key}`, value);
      return;
    }

    // Acquire lock for this resourceName to serialize setItem operations
    let lockPromise = setItemLocks.get(this.resourceName);
    if (lockPromise) {
      await lockPromise;
    }

    // Create a new lock promise that will be resolved when this operation completes
    let resolveLock: (() => void) | undefined;
    const newLockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    setItemLocks.set(this.resourceName, newLockPromise);

    try {
      const newData = { data: { [key]: value } };
      // Ensure storage is initialized
      const error = await this.init();
      if (error) {
        // Fallback to localStorage
        store.set(`${this.resourceName}:${key}`, value);
        return;
      }

      const storageSpec = storageCache.get(this.resourceName);
      if (!storageSpec || storageSpec instanceof Promise) {
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
      // Release the lock
      if (resolveLock) {
        resolveLock();
      }
      // Remove lock if it's still the current one (in case another operation started)
      if (setItemLocks.get(this.resourceName) === newLockPromise) {
        setItemLocks.delete(this.resourceName);
      }
    }
  }
}

// This is a type alias to avoid breaking changes
export interface PluginUserStorage extends UserStorageType { }

/**
 * A hook for interacting with the backend user storage (or local storage if not enabled).
 * @returns An scoped object for a plugin and a user with getItem and setItem functions.
 * @alpha Experimental
 */
export function usePluginUserStorage(): PluginUserStorage {
  const context = usePluginContext();
  if (!context) {
    throw new Error(`No PluginContext found. The usePluginUserStorage() hook can only be used from a plugin.`);
  }
  return new UserStorage(context?.meta.id);
}
