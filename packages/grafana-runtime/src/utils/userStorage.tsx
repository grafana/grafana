import { get } from 'lodash';
import { lastValueFrom } from 'rxjs';

import { usePluginContext } from '@grafana/data';

import { config } from '../config';
import { BackendSrvRequest, getBackendSrv } from '../services';

const baseURL = `/apis/userstorage.grafana.app/v0alpha1/namespaces/${config.namespace}/user-storage`;

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
      })
    );
    return { data: responseData, meta };
  } catch (error) {
    return requestOptions.manageError ? requestOptions.manageError(error) : { error };
  }
}

/**
 * A class for interacting with the backend user storage.
 * Unexported because it is currently only be used through the useUserStorage hook.
 */
class UserStorage {
  private service: string;
  private resourceName: string;
  private userUID: string;
  private canUseUserStorage: boolean;
  private storageSpec: UserStorageSpec | null | undefined;

  constructor(service: string) {
    this.service = service;
    this.userUID = config.bootData.user.uid === '' ? config.bootData.user.id.toString() : config.bootData.user.uid;
    this.resourceName = `${service}:${this.userUID}`;
    this.canUseUserStorage = config.featureToggles.userStorageAPI === true && config.bootData.user.isSignedIn;
  }

  private async init() {
    if (this.storageSpec !== undefined) {
      return;
    }
    const userStorage = await apiRequest<{ spec: UserStorageSpec }>({
      url: `/${this.resourceName}`,
      method: 'GET',
      showErrorAlert: false,
    });
    if ('error' in userStorage) {
      if (get(userStorage, 'error.status') !== 404) {
        console.error('Failed to get user storage', userStorage.error);
      }
      // No user storage found, return null
      this.storageSpec = null;
    } else {
      this.storageSpec = userStorage.data.spec;
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      return localStorage.getItem(this.resourceName);
    }
    // Ensure this.storageSpec is initialized
    await this.init();
    if (!this.storageSpec) {
      // Also, fallback to localStorage for backward compatibility once userStorageAPI is enabled
      return localStorage.getItem(this.resourceName);
    }
    return this.storageSpec.data[key];
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      localStorage.setItem(key, value);
      return;
    }

    const newData = { data: { [key]: value } };
    // Ensure this.storageSpec is initialized
    await this.init();

    if (!this.storageSpec) {
      // No user storage found, create a new one
      await apiRequest<UserStorageSpec>({
        url: `/`,
        method: 'POST',
        body: {
          metadata: { name: this.resourceName, labels: { user: this.userUID, service: this.service } },
          spec: newData,
        },
      });
      this.storageSpec = newData;
      return;
    }

    // Update existing user storage
    this.storageSpec.data[key] = value;
    await apiRequest<UserStorageSpec>({
      headers: { 'Content-Type': 'application/merge-patch+json' },
      url: `/${this.resourceName}`,
      method: 'PATCH',
      body: { spec: newData },
    });
  }
}

export interface PluginUserStorage {
  /**
   * Retrieves an item from the backend user storage or local storage if not enabled.
   * @param key - The key of the item to retrieve.
   * @returns A promise that resolves to the item value or null if not found.
   */
  getItem(key: string): Promise<string | null>;
  /**
   * Sets an item in the backend user storage or local storage if not enabled.
   * @param key - The key of the item to set.
   * @param value - The value of the item to set.
   * @returns A promise that resolves when the item is set.
   */
  setItem(key: string, value: string): Promise<void>;
}

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
