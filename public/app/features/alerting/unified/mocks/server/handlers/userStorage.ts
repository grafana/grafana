import { HttpResponse, http } from 'msw';

import { config } from '@grafana/runtime';

/**
 * UserStorage spec type matching the backend API response.
 */
interface UserStorageSpec {
  data: { [key: string]: string };
}

/**
 * In-memory storage for UserStorage mock data.
 * This allows tests to set up and verify storage state.
 */
let userStorageData: Record<string, UserStorageSpec> = {};

/**
 * Get the base URL for UserStorage API.
 * Uses config.namespace which defaults to 'default' in tests.
 */
const getBaseUrl = () => `/apis/userstorage.grafana.app/v0alpha1/namespaces/${config.namespace}/user-storage`;

/**
 * Reset the in-memory storage. Call this in beforeEach to ensure clean test state.
 */
export function resetUserStorage(): void {
  userStorageData = {};
}

/**
 * Get the resource name for a given service, matching how UserStorage constructs it.
 * This uses config.bootData.user to determine the user identifier.
 *
 * @param service - The service name (e.g., 'alerting')
 * @returns The resource name in format `{service}:{userUID}`
 *
 * @example
 * // In a test with config.bootData.user = { uid: '', id: 123 }
 * const resourceName = getResourceName('alerting'); // 'alerting:123'
 *
 * // In a test with config.bootData.user = { uid: 'abc-123', id: 456 }
 * const resourceName = getResourceName('alerting'); // 'alerting:abc-123'
 */
export function getResourceName(service: string): string {
  const user = config.bootData?.user;
  const userUID = user?.uid === '' || !user?.uid ? String(user?.id ?? 'anonymous') : user.uid;
  return `${service}:${userUID}`;
}

/**
 * Convenience constant for the alerting service name.
 * Use with getResourceName('alerting') or ALERTING_SERVICE directly.
 */
export const ALERTING_SERVICE = 'alerting';

/**
 * Set up initial data in the UserStorage mock.
 * @param resourceName - The resource name (e.g., 'alerting:123'). Use getResourceName() to construct this.
 * @param key - The storage key
 * @param value - The value to store
 */
export function setUserStorageItem(resourceName: string, key: string, value: string): void {
  if (!userStorageData[resourceName]) {
    userStorageData[resourceName] = { data: {} };
  }
  userStorageData[resourceName].data[key] = value;
}

/**
 * Convenience function to set alerting storage items using the current config's user.
 * This automatically constructs the resource name from config.bootData.user.
 *
 * @param key - The storage key (e.g., 'savedSearches')
 * @param value - The value to store (will be stored as-is, caller should JSON.stringify if needed)
 *
 * @example
 * // Set up saved searches for testing
 * setAlertingStorageItem('savedSearches', JSON.stringify([{ id: '1', name: 'Test', query: 'state:firing', isDefault: false, createdAt: Date.now() }]));
 */
export function setAlertingStorageItem(key: string, value: string): void {
  const resourceName = getResourceName(ALERTING_SERVICE);
  setUserStorageItem(resourceName, key, value);
}

/**
 * Convenience function to get alerting storage items using the current config's user.
 *
 * @param key - The storage key (e.g., 'savedSearches')
 * @returns The stored value or null if not found
 */
export function getAlertingStorageItem(key: string): string | null {
  const resourceName = getResourceName(ALERTING_SERVICE);
  return getUserStorageItem(resourceName, key);
}

/**
 * Get data from the UserStorage mock.
 * @param resourceName - The resource name (e.g., 'alerting:123')
 * @param key - The storage key
 * @returns The stored value or null if not found
 */
export function getUserStorageItem(resourceName: string, key: string): string | null {
  return userStorageData[resourceName]?.data[key] ?? null;
}

/**
 * Get the full storage spec for a resource.
 * @param resourceName - The resource name
 */
export function getUserStorageSpec(resourceName: string): UserStorageSpec | null {
  return userStorageData[resourceName] ?? null;
}

/**
 * MSW handler for GET UserStorage (retrieve stored data)
 */
const getUserStorageHandler = () =>
  http.get<{ resourceName: string }>(`${getBaseUrl()}/:resourceName`, ({ params }) => {
    const spec = userStorageData[params.resourceName];

    if (!spec) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return HttpResponse.json({ spec });
  });

/**
 * MSW handler for POST UserStorage (create new storage)
 */
const createUserStorageHandler = () =>
  http.post(getBaseUrl(), async ({ request }) => {
    const body = (await request.json()) as {
      metadata: { name: string; labels: { user: string; service: string } };
      spec: UserStorageSpec;
    };

    const resourceName = body.metadata.name;
    userStorageData[resourceName] = body.spec;

    return HttpResponse.json({ spec: body.spec }, { status: 201 });
  });

/**
 * MSW handler for PATCH UserStorage (update existing storage)
 */
const patchUserStorageHandler = () =>
  http.patch<{ resourceName: string }>(`${getBaseUrl()}/:resourceName`, async ({ params, request }) => {
    const body = (await request.json()) as { spec: UserStorageSpec };
    const resourceName = params.resourceName;

    if (!userStorageData[resourceName]) {
      userStorageData[resourceName] = { data: {} };
    }

    // Merge the new data with existing data
    userStorageData[resourceName].data = {
      ...userStorageData[resourceName].data,
      ...body.spec.data,
    };

    return HttpResponse.json({ spec: userStorageData[resourceName] });
  });

/**
 * All UserStorage MSW handlers
 */
const handlers = [getUserStorageHandler(), createUserStorageHandler(), patchUserStorageHandler()];

export default handlers;
