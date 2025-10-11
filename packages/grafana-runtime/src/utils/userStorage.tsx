import { get } from 'lodash';
import { lastValueFrom } from 'rxjs';

import { usePluginContext, type UserStorage as UserStorageType } from '@grafana/data';

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
  private storageSpec: UserStorageSpec | null | undefined;

  constructor(service: string) {
    this.service = service;
    this.userUID = config.bootData.user.uid === '' ? config.bootData.user.id.toString() : config.bootData.user.uid;
    this.resourceName = `${service}:${this.userUID}`;
    this.canUseUserStorage = config.bootData.user.isSignedIn;
  }

  private async init() {
    if (this.storageSpec !== undefined) {
      return;
    }
    const userStorage = await apiRequest<{ spec: UserStorageSpec }>({
      url: `/${this.resourceName}`,
      method: 'GET',
      manageError: (error) => {
        if (get(error, 'status') === 404) {
          this.storageSpec = null;
          return { error: null };
        }
        return { error };
      },
    });
    if ('error' in userStorage) {
      return userStorage.error;
    }
    this.storageSpec = userStorage.data.spec;
    return;
  }

  async getItem(key: string): Promise<string | null> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      return localStorage.getItem(`${this.resourceName}:${key}`);
    }
    // Ensure this.storageSpec is initialized
    await this.init();
    if (!this.storageSpec) {
      // Also, fallback to localStorage for backward compatibility
      return localStorage.getItem(`${this.resourceName}:${key}`);
    }
    return this.storageSpec.data[key];
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!this.canUseUserStorage) {
      // Fallback to localStorage
      localStorage.setItem(`${this.resourceName}:${key}`, value);
      return;
    }

    const newData = { data: { [key]: value } };
    // Ensure this.storageSpec is initialized
    const error = await this.init();
    if (error) {
      // Fallback to localStorage
      localStorage.setItem(`${this.resourceName}:${key}`, value);
      return;
    }

    if (!this.storageSpec) {
      // No user storage found, create a new one
      await apiRequest<UserStorageSpec>({
        url: `/`,
        method: 'POST',
        body: {
          metadata: { name: this.resourceName, labels: { user: this.userUID, service: this.service } },
          spec: newData,
        },
        manageError: (error) => {
          // Fallback to localStorage
          localStorage.setItem(`${this.resourceName}:${key}`, value);
          return { error };
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
      manageError: (error) => {
        // Fallback to localStorage
        localStorage.setItem(`${this.resourceName}:${key}`, value);
        return { error };
      },
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
  if (!context) {
    throw new Error(`No PluginContext found. The usePluginUserStorage() hook can only be used from a plugin.`);
  }
  return new UserStorage(context?.meta.id);
}

/**
 * A function for interacting with the backend user storage (or local storage if not enabled).
 * @returns An scoped object for a plugin and a user with getItem and setItem functions.
 * @alpha Experimental
 */
export function getPluginUserStorage(): UserStorage {
  const pluginId = getPluginIdFromUrl();
  if (!pluginId) {
    throw new Error(
      'getUserStorage() could not determine the current plugin ID from URL. ' +
        'This function must be called from within an app plugin context (URL pattern: /a/plugin-id). ' +
        'For React components, use usePluginUserStorage() hook instead.'
    );
  }
  return new UserStorage(pluginId);
}

function getPluginIdFromUrl(): string | null {
  // App plugin URL pattern: /a/{pluginId}/... or /a/{pluginId}
  const [, appPluginId] = window.location.pathname.match(/\/a\/([^\/\?]+)/) || [];
  return appPluginId || null;
}
