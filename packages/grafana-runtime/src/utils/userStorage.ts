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
  serviceMap: { [key: string]: string };
  UserUID: string;
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

function getUserUID() {
  if (config.bootData.user.uid === '') {
    return `user:${config.bootData.user.id}`;
  }
  return `user:${config.bootData.user.uid}`;
}

function canUseUserStorage(): boolean {
  return config.featureToggles.userStorageAPI === true && config.bootData.user.isSignedIn;
}

async function getUserStorage(): Promise<{ spec: UserStorageSpec } | null> {
  const userStorage = await apiRequest<{ spec: UserStorageSpec }>({
    url: `/${getUserUID()}`,
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
 * Retrieves an item from the backend user storage or local storage if not enabled.
 * @param key - The key of the item to retrieve.
 * @returns A promise that resolves to the item value or null if not found.
 */
export async function getItem(key: string): Promise<string | null> {
  if (!canUseUserStorage()) {
    // Fallback to localStorage
    return localStorage.getItem(key);
  }
  const userStorage = await getUserStorage();
  if (!userStorage) {
    // Also, fallback to localStorage for backward compatibility once userStorageAPI is enabled
    return localStorage.getItem(key);
  }
  return userStorage.spec.serviceMap[key];
}

/**
 * Sets an item in the backend user storage or local storage if not enabled.
 * @param key - The key of the item to set.
 * @param value - The value of the item to set.
 * @returns A promise that resolves when the item is set.
 */
export async function setItem(key: string, value: string): Promise<void> {
  if (!canUseUserStorage()) {
    // Fallback to localStorage
    localStorage.setItem(key, value);
    return;
  }

  const userUID = getUserUID();
  const userStorage = await getUserStorage();
  if (!userStorage) {
    // No user storage found, create a new one
    const userStorageData = {
      serviceMap: { [key]: value },
      UserUID: userUID,
    };
    await apiRequest<UserStorageSpec>({
      url: `/`,
      method: 'POST',
      body: { metadata: { name: userUID }, spec: userStorageData },
    });
    return;
  }

  // Update existing user storage
  userStorage.spec.serviceMap[key] = value;
  await apiRequest<UserStorageSpec>({
    url: `/${userUID}`,
    method: 'PUT',
    body: userStorage,
  });
}
