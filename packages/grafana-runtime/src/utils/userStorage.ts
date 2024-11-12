import { get } from 'lodash';
import { lastValueFrom } from 'rxjs';

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

function getUserUID(): string {
  return config.bootData.user.uid === '' ? config.bootData.user.id.toString() : config.bootData.user.uid;
}

function getResourceName(scope: string): string {
  return `${scope}:${getUserUID()}`;
}

function canUseUserStorage(): boolean {
  return config.featureToggles.userStorageAPI === true && config.bootData.user.isSignedIn;
}

async function getUserStorage(resourceName: string): Promise<{ spec: UserStorageSpec } | null> {
  const userStorage = await apiRequest<{ spec: UserStorageSpec }>({
    url: `/${resourceName}`,
    method: 'GET',
    showErrorAlert: false,
  });
  if ('error' in userStorage) {
    if (get(userStorage, 'error.status') !== 404) {
      console.error('Failed to get user storage', userStorage.error);
    }
    // No user storage found, return null
    return null;
  }
  return userStorage.data;
}

/**
 * A class for interacting with the backend user storage.
 */
export class UserStorage {
  service: string;

  constructor(service: string) {
    this.service = service;
  }

  /**
   * Retrieves an item from the backend user storage or local storage if not enabled.
   * @param key - The key of the item to retrieve.
   * @returns A promise that resolves to the item value or null if not found.
   */
  async getItem(key: string): Promise<string | null> {
    const resourceName = getResourceName(this.service);
    if (!canUseUserStorage()) {
      // Fallback to localStorage
      return localStorage.getItem(resourceName);
    }
    const userStorage = await getUserStorage(resourceName);
    if (!userStorage) {
      // Also, fallback to localStorage for backward compatibility once userStorageAPI is enabled
      return localStorage.getItem(resourceName);
    }
    return userStorage.spec.data[key];
  }

  /**
   * Sets an item in the backend user storage or local storage if not enabled.
   * @param key - The key of the item to set.
   * @param value - The value of the item to set.
   * @returns A promise that resolves when the item is set.
   */
  async setItem(key: string, value: string): Promise<void> {
    const resourceName = getResourceName(this.service);
    if (!canUseUserStorage()) {
      // Fallback to localStorage
      localStorage.setItem(key, value);
      return;
    }

    const userStorage = await getUserStorage(resourceName);
    if (!userStorage) {
      // No user storage found, create a new one
      const userStorageData = { [key]: value };
      await apiRequest<UserStorageSpec>({
        url: `/`,
        method: 'POST',
        body: {
          metadata: { name: resourceName, labels: { user: getUserUID(), service: this.service } },
          spec: { data: userStorageData },
        },
      });
      return;
    }

    // Update existing user storage
    userStorage.spec.data[key] = value;
    await apiRequest<UserStorageSpec>({
      url: `/${resourceName}`,
      method: 'PUT',
      body: userStorage,
    });
  }
}
