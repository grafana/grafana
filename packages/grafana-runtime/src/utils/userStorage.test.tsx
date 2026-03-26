import { cloneDeep } from 'lodash';
import { of } from 'rxjs';

import { config } from '../config';
import { BackendSrvRequest, FetchError, FetchResponse, BackendSrv } from '../services';

import { usePluginUserStorage, _clearStorageCache } from './userStorage';

const request = jest.fn<Promise<FetchResponse | FetchError>, BackendSrvRequest[]>();

const backendSrv = {
  fetch: (options: BackendSrvRequest) => {
    return of(request(options));
  },
} as unknown as BackendSrv;

jest.mock('../services', () => ({
  ...jest.requireActual('../services'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('@grafana/data', () => {
  const storeMocks = {
    get: jest.fn(),
    set: jest.fn(),
  };
  return {
    ...jest.requireActual('@grafana/data'),
    usePluginContext: jest.fn().mockReturnValue({ meta: { id: 'plugin-id' } }),
    store: storeMocks,
  };
});

// Get reference to the mocked store for use in tests
const getStoreMocks = () => {
  const { store } = require('@grafana/data');
  return store;
};

describe('userStorage', () => {
  const originalConfig = cloneDeep(config);

  beforeEach(() => {
    config.bootData.user.isSignedIn = true;
    config.bootData.user.uid = 'abc';
    request.mockReset();
    const store = getStoreMocks();
    store.get.mockReset();
    store.set.mockReset();
    _clearStorageCache();
  });

  afterEach(() => {
    config.featureToggles = originalConfig.featureToggles;
    config.bootData = originalConfig.bootData;
  });

  describe('UserStorageAPI.getItem', () => {
    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      const storage = usePluginUserStorage();
      await storage.getItem('key');
      expect(getStoreMocks().get).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('use localStorage if the user storage is not found', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      const storage = usePluginUserStorage();
      await storage.getItem('key');
      expect(getStoreMocks().get).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('returns the value from the user storage', async () => {
      request.mockReturnValue(
        Promise.resolve({ status: 200, data: { spec: { data: { key: 'value' } } } } as FetchResponse)
      );
      const storage = usePluginUserStorage();
      const value = await storage.getItem('key');
      expect(value).toBe('value');
    });
  });

  describe('setItem', () => {
    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      const storage = usePluginUserStorage();
      await storage.setItem('key', 'value');
      expect(getStoreMocks().set).toHaveBeenCalledWith('plugin-id:abc:key', 'value');
    });

    it('creates a new user storage if it does not exist', async () => {
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));
      const storage = usePluginUserStorage();
      await storage.setItem('key', 'value');
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/plugin-id:abc',
          method: 'GET',
          showErrorAlert: false,
        })
      );
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/',
          method: 'POST',
          data: {
            metadata: { labels: { service: 'plugin-id', user: 'abc' }, name: 'plugin-id:abc' },
            spec: {
              data: { key: 'value' },
            },
          },
        })
      );
      expect(getStoreMocks().set).not.toHaveBeenCalled();
    });

    it('falls back to localStorage if the user storage fails to be created', async () => {
      // Get fails with not found
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      // Create fails with forbidden
      request.mockReturnValueOnce(Promise.reject({ status: 403 } as FetchError));
      const storage = usePluginUserStorage();
      await storage.setItem('key', 'value');
      expect(getStoreMocks().set).toHaveBeenCalledWith('plugin-id:abc:key', 'value');
    });

    it('updates the user storage if it exists', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { metadata: { name: 'service:abc' }, spec: { data: { key: 'value' } } },
        } as FetchResponse)
      );
      const storage = usePluginUserStorage();
      await storage.setItem('key', 'new-value');
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/plugin-id:abc',
          method: 'GET',
          showErrorAlert: false,
        })
      );
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/plugin-id:abc',
          method: 'PATCH',
          data: {
            spec: {
              data: { key: 'new-value' },
            },
          },
        })
      );
    });

    it('handles storageSpec as Promise by awaiting it before creating storage', async () => {
      // This test verifies that setItem correctly awaits a Promise in storageSpec
      // Scenario: init() completes and sets null in cache, then setItem should create storage
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage = usePluginUserStorage();

      // First, trigger init which will cache null (404)
      await storage.getItem('some-key');

      // Now setItem should see null in cache and create new storage
      await storage.setItem('key', 'value');

      // Should have made GET (init) and POST (create) requests
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/plugin-id:abc',
          method: 'GET',
        })
      );
      expect(request).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/',
          method: 'POST',
        })
      );

      // Verify the value was stored
      const value = await storage.getItem('key');
      expect(value).toBe('value');
    });

    it('handles storageSpec as Promise by awaiting it before updating storage', async () => {
      // This test verifies that setItem correctly awaits a Promise in storageSpec
      // Scenario: init() completes with data, then setItem should update it
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key: 'old-value' } } },
        } as FetchResponse)
      );
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage = usePluginUserStorage();

      // First, trigger init which will cache the data
      await storage.getItem('key');

      // Now setItem should see the data in cache and update it
      await storage.setItem('key', 'new-value');

      // Should have made GET (init) and PATCH (update) requests
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/plugin-id:abc',
          method: 'GET',
        })
      );
      expect(request).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/plugin-id:abc',
          method: 'PATCH',
        })
      );

      // Verify the value was updated
      const value = await storage.getItem('key');
      expect(value).toBe('new-value');
    });
  });

  describe('Cache behavior', () => {
    it('multiple instances share the same network request', async () => {
      request.mockReturnValue(
        Promise.resolve({ status: 200, data: { spec: { data: { key: 'value' } } } } as FetchResponse)
      );
      const storage1 = usePluginUserStorage();
      const storage2 = usePluginUserStorage();

      // Both should call getItem concurrently
      const [value1, value2] = await Promise.all([storage1.getItem('key'), storage2.getItem('key')]);

      // Should only make one network request
      expect(request).toHaveBeenCalledTimes(1);
      expect(value1).toBe('value');
      expect(value2).toBe('value');
    });

    it('caches 404 responses to avoid multiple requests', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      const storage1 = usePluginUserStorage();
      const storage2 = usePluginUserStorage();

      // Both should call getItem concurrently
      await Promise.all([storage1.getItem('key'), storage2.getItem('key')]);

      // Should only make one network request despite multiple instances
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('updates cache after creating new storage', async () => {
      // First call: 404, then create
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage1 = usePluginUserStorage();
      await storage1.setItem('key1', 'value1');

      // Second instance should use cached data without network request
      request.mockReset();
      const storage2 = usePluginUserStorage();
      const value = await storage2.getItem('key1');

      // Should not make a GET request because cache has the data
      expect(request).not.toHaveBeenCalled();
      expect(value).toBe('value1');
    });

    it('updates cache after modifying existing storage', async () => {
      // Initial GET returns existing data
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key1: 'value1' } } },
        } as FetchResponse)
      );
      // PATCH updates the storage
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage1 = usePluginUserStorage();
      await storage1.setItem('key1', 'new-value1');

      // Second instance should get updated value from cache
      request.mockReset();
      const storage2 = usePluginUserStorage();
      const value = await storage2.getItem('key1');

      // Should not make a GET request because cache has the updated data
      expect(request).not.toHaveBeenCalled();
      expect(value).toBe('new-value1');
    });

    it('concurrent initialization requests share the same promise', async () => {
      let resolvePromise: (value: FetchResponse | FetchError) => void;
      const promise = new Promise<FetchResponse | FetchError>((resolve) => {
        resolvePromise = resolve;
      });

      request.mockReturnValue(promise);

      const storage1 = usePluginUserStorage();
      const storage2 = usePluginUserStorage();

      // Start both getItem calls concurrently
      const promise1 = storage1.getItem('key');
      const promise2 = storage2.getItem('key');

      // Wait a bit to allow both operations to start (first acquires lock, second waits)
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only make one network request (second call will reuse the promise from cache)
      expect(request).toHaveBeenCalledTimes(1);

      // Resolve the request
      resolvePromise!({ status: 200, data: { spec: { data: { key: 'value' } } } } as FetchResponse);

      const [value1, value2] = await Promise.all([promise1, promise2]);

      // Verify both got the same value and only one request was made
      expect(value1).toBe('value');
      expect(value2).toBe('value');
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('serializes concurrent setItem operations to prevent race conditions', async () => {
      // Initial GET returns existing data
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key1: 'initial' } } },
        } as FetchResponse)
      );
      // Two PATCH requests for concurrent setItem calls
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage1 = usePluginUserStorage();
      const storage2 = usePluginUserStorage();

      // Call setItem concurrently on different keys
      await Promise.all([storage1.setItem('key1', 'value1'), storage2.setItem('key2', 'value2')]);

      // Both operations should complete successfully
      // Verify both values are in cache
      const value1 = await storage1.getItem('key1');
      const value2 = await storage2.getItem('key2');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      // Should have made 1 GET and 2 PATCH requests
      expect(request).toHaveBeenCalledTimes(3);
    });

    it('handles concurrent setItem on the same key correctly', async () => {
      // Initial GET returns existing data
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key1: 'initial' } } },
        } as FetchResponse)
      );
      // Two PATCH requests for concurrent setItem calls on same key
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage1 = usePluginUserStorage();
      const storage2 = usePluginUserStorage();

      // Call setItem concurrently on the same key
      await Promise.all([storage1.setItem('key1', 'value1'), storage2.setItem('key1', 'value2')]);

      // Both operations should complete (last one wins)
      const finalValue = await storage1.getItem('key1');
      expect(finalValue).toBe('value2'); // Last write wins
      // Should have made 1 GET and 2 PATCH requests
      expect(request).toHaveBeenCalledTimes(3);
    });
  });
});
