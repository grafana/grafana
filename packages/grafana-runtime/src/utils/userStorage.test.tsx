import { renderHook } from '@testing-library/react';
import { cloneDeep } from 'lodash';
import { of } from 'rxjs';

import { config } from '../config';
import { type BackendSrvRequest, type FetchError, type FetchResponse, type BackendSrv } from '../services';

import { usePluginUserStorage, useUserStorage, _clearStorageCache, UserStorage } from './userStorage';

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
    delete: jest.fn(),
    all: jest.fn().mockReturnValue({}),
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
    store.delete.mockReset();
    store.all.mockReset().mockReturnValue({});
    _clearStorageCache();
  });

  afterEach(() => {
    config.featureToggles = originalConfig.featureToggles;
    config.bootData = originalConfig.bootData;
  });

  describe('scoped plugin storage', () => {
    const resource = (data: Record<string, string>, resourceVersion: string) =>
      Promise.resolve({ status: 200, data: { metadata: { resourceVersion }, spec: { data } } } as FetchResponse);
    const missing = () => Promise.reject({ status: 404 });
    const options = { migrateKeyPrefixes: ['pages:'], removeEmptyKeyPrefixes: ['preview-', 'export-'] };

    it('uses a separate service record and stable instance for a fixed scope', async () => {
      const plugin = renderHook(() => usePluginUserStorage()).result.current;
      const scoped = plugin.getScopedStorage('pages');
      expect(plugin.getScopedStorage('pages')).toBe(scoped);
      request.mockReturnValue(resource({ notes: 'scoped value' }, '1'));
      await expect(scoped.getItem('notes')).resolves.toBe('scoped value');
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET', url: expect.stringContaining('/user-storage/plugin-id.pages:abc') })
      );
    });

    it('rejects changed migration options rather than silently skipping them', () => {
      const plugin = new UserStorage('plugin-id');
      plugin.getScopedStorage('pages');
      expect(() => plugin.getScopedStorage('pages', options)).toThrow('options must stay the same');
    });

    it.each(['', 'pages:other-user', '../pages', 'Page', 'a'.repeat(65)])('rejects invalid scope %s', (scope) => {
      expect(() => new UserStorage('plugin-id').getScopedStorage(scope)).toThrow('scope');
      expect(request).not.toHaveBeenCalled();
    });

    it('rejects empty migration prefixes that would select unrelated preferences', () => {
      expect(() => new UserStorage('plugin-id').getScopedStorage('pages', { migrateKeyPrefixes: [''] })).toThrow(
        'prefixes'
      );
    });

    it('copies Page keys before removing them and only prunes empty temporary keys in one patch', async () => {
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      const copied = { 'pages:notes': 'draft', 'pages:empty': '' };
      request.mockImplementationOnce(() =>
        resource(
          { ...copied, preference: 'keep', 'preview-old': '', 'export-old': '', 'preview-active': 'dashboard JSON' },
          '7'
        )
      );
      request.mockImplementationOnce(missing);
      request.mockImplementationOnce(() => resource(copied, '1'));
      request.mockImplementationOnce(() => resource({ preference: 'keep', 'preview-active': 'dashboard JSON' }, '8'));
      request.mockImplementationOnce(() => resource(copied, '1'));
      await expect(scoped.getItem('pages:notes')).resolves.toBe('draft');
      expect(request).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          method: 'POST',
          data: {
            metadata: { name: 'plugin-id.pages:abc', labels: { user: 'abc', service: 'plugin-id.pages' } },
            spec: { data: copied },
          },
        })
      );
      expect(request).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          method: 'PATCH',
          url: expect.stringContaining('/user-storage/plugin-id:abc'),
          data: {
            metadata: { resourceVersion: '7' },
            spec: {
              data: {
                'pages:notes': null,
                'pages:empty': null,
                'preview-old': null,
                'export-old': null,
              },
            },
          },
        })
      );
      expect(request).toHaveBeenCalledTimes(5);
    });

    it('does not delete the source or fall back locally when the destination write fails', async () => {
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'draft' }, '7'));
      request.mockImplementationOnce(missing);
      request.mockRejectedValueOnce({ status: 503 });
      await expect(scoped.setItem('pages:notes', 'new draft')).rejects.toEqual({ status: 503 });
      expect(request).toHaveBeenCalledTimes(3);
      expect(getStoreMocks().set).not.toHaveBeenCalled();
    });

    it('retains differing legacy edits and never overwrites a newer scoped value', async () => {
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'legacy edit' }, '7'));
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'newer scoped edit' }, '2'));
      await expect(scoped.getItem('pages:notes')).resolves.toBe('newer scoped edit');
      expect(request).toHaveBeenCalledTimes(2);
      expect(request.mock.calls.map(([call]) => call.method)).toEqual(['GET', 'GET']);
    });

    it('preserves a concurrent legacy edit when source cleanup conflicts', async () => {
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'original' }, '7'));
      request.mockImplementationOnce(missing);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'original' }, '1'));
      request.mockRejectedValueOnce({ status: 409 });
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'concurrent edit' }, '8'));
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'original' }, '1'));
      await expect(scoped.getItem('pages:notes')).resolves.toBe('original');
      expect(request).toHaveBeenCalledTimes(6);
      expect(request.mock.calls.filter(([call]) => call.method === 'PATCH')).toHaveLength(1);
      expect(request).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          data: {
            metadata: { resourceVersion: '7' },
            spec: { data: { 'pages:notes': null } },
          },
        })
      );
    });

    it('merges missing keys into an existing destination with a resource-version precondition', async () => {
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'draft' }, '7'));
      request.mockImplementationOnce(() => resource({ 'pages:other': 'keep' }, '2'));
      request.mockImplementationOnce(() => resource({ 'pages:other': 'keep', 'pages:notes': 'draft' }, '3'));
      request.mockImplementationOnce(() => resource({}, '8'));
      request.mockImplementationOnce(() => resource({ 'pages:other': 'keep', 'pages:notes': 'draft' }, '3'));
      await expect(scoped.getItem('pages:notes')).resolves.toBe('draft');
      expect(request).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          method: 'PATCH',
          data: {
            metadata: { resourceVersion: '2' },
            spec: { data: { 'pages:notes': 'draft' } },
          },
        })
      );
    });

    it('can resume after cleanup fails without copying a value twice', async () => {
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'draft' }, '7'));
      request.mockImplementationOnce(missing);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'draft' }, '1'));
      request.mockRejectedValueOnce({ status: 503 });
      await expect(scoped.getItem('pages:notes')).rejects.toEqual({ status: 503 });
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'draft' }, '7'));
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'draft' }, '1'));
      request.mockImplementationOnce(() => resource({}, '8'));
      await expect(scoped.getItem('pages:notes')).resolves.toBe('draft');
      expect(request).toHaveBeenCalledTimes(7);
      expect(request.mock.calls.filter(([call]) => call.method === 'POST')).toHaveLength(1);
    });

    it('moves signed-out browser values without deleting unrelated or conflicting data', async () => {
      config.bootData.user.isSignedIn = false;
      const local = getStoreMocks();
      local.all.mockReturnValue({
        'pages:notes': 'draft',
        'pages:conflict': 'old draft',
        preference: 'keep',
        'preview-old': '',
      });
      local.get.mockImplementation((key: string) => (key.endsWith(':pages:conflict') ? 'new draft' : undefined));
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      await scoped.getItem('pages:notes');
      expect(local.set).toHaveBeenCalledWith('plugin-id.pages:abc:pages:notes', 'draft');
      expect(local.delete.mock.calls).toEqual([['plugin-id:abc:pages:notes'], ['plugin-id:abc:preview-old']]);
      expect(request).not.toHaveBeenCalled();
    });

    it('preserves signed-in browser fallback values when there is no legacy server record', async () => {
      const local = getStoreMocks();
      local.all.mockReturnValue({ 'pages:notes': 'offline draft' });
      request.mockImplementation(missing);
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      await scoped.getItem('pages:notes');
      expect(local.set).toHaveBeenCalledWith('plugin-id.pages:abc:pages:notes', 'offline draft');
      expect(local.delete).toHaveBeenCalledWith('plugin-id:abc:pages:notes');
    });

    it('retries a target create race without overwriting the other writer', async () => {
      const scoped = new UserStorage('plugin-id').getScopedStorage('pages', options);
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'old' }, '7'));
      request.mockImplementationOnce(missing);
      request.mockRejectedValueOnce({ status: 409 });
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'old' }, '7'));
      request.mockImplementationOnce(() => resource({ 'pages:notes': 'other tab' }, '1'));
      await expect(scoped.getItem('pages:notes')).resolves.toBe('other tab');
      expect(request).toHaveBeenCalledTimes(5);
      expect(request.mock.calls.filter(([call]) => call.method === 'PATCH')).toHaveLength(0);
    });
  });

  describe('UserStorageAPI.getItem', () => {
    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.getItem('key');
      expect(getStoreMocks().get).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('use localStorage if the user storage is not found', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.getItem('key');
      expect(getStoreMocks().get).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('returns the value from the user storage', async () => {
      request.mockReturnValue(
        Promise.resolve({ status: 200, data: { spec: { data: { key: 'value' } } } } as FetchResponse)
      );
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      const value = await storage.getItem('key');
      expect(value).toBe('value');
    });
  });

  describe('setItem', () => {
    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.setItem('key', 'value');
      expect(getStoreMocks().set).toHaveBeenCalledWith('plugin-id:abc:key', 'value');
    });

    it('creates a new user storage if it does not exist', async () => {
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));
      const storage = renderHook(() => usePluginUserStorage()).result.current;
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
      const storage = renderHook(() => usePluginUserStorage()).result.current;
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
      const storage = renderHook(() => usePluginUserStorage()).result.current;
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

      const storage = renderHook(() => usePluginUserStorage()).result.current;

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

      const storage = renderHook(() => usePluginUserStorage()).result.current;

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

  describe('deleteItem', () => {
    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.deleteItem('key');
      expect(getStoreMocks().delete).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('use localStorage if the user storage is not found', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.deleteItem('key');
      expect(getStoreMocks().delete).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('deletes an item from the user storage', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { metadata: { name: 'service:abc' }, spec: { data: { key: 'value', other: 'data' } } },
        } as FetchResponse)
      );
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.deleteItem('key');
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
              data: { key: null },
            },
          },
        })
      );
    });

    it('falls back to localStorage if the delete operation fails', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { metadata: { name: 'service:abc' }, spec: { data: { key: 'value' } } },
        } as FetchResponse)
      );
      request.mockReturnValueOnce(Promise.reject({ status: 403 } as FetchError));
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.deleteItem('key');
      expect(getStoreMocks().delete).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('updates cache after deleting an item', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key: 'value', other: 'data' } } },
        } as FetchResponse)
      );
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      await storage1.deleteItem('key');

      // Second instance should see updated cache without network request
      request.mockReset();
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;
      const value = await storage2.getItem('key');

      // Should not make a GET request because cache has the updated data
      expect(request).not.toHaveBeenCalled();
      expect(value).toBeNull();
    });

    it('verifies other keys remain after deletion', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key1: 'value1', key2: 'value2' } } },
        } as FetchResponse)
      );
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.deleteItem('key1');

      // Get the deleted key
      request.mockReset();
      const deletedValue = await storage.getItem('key1');
      expect(deletedValue).toBeNull();

      // Get another key
      const otherValue = await storage.getItem('key2');
      expect(otherValue).toBe('value2');
    });
  });

  describe('allItems', () => {
    it('uses localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      getStoreMocks().all = jest.fn().mockReturnValue({ key: 'value' });
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      const result = await storage.allItems();
      expect(getStoreMocks().all).toHaveBeenCalledWith('plugin-id:abc:');
      expect(result).toEqual({ key: 'value' });
    });

    it('returns all items from user storage', async () => {
      request.mockReturnValue(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key1: 'value1', key2: 'value2' } } },
        } as FetchResponse)
      );
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      const result = await storage.allItems();
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('returns empty object when user storage is not found', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      getStoreMocks().all = jest.fn().mockReturnValue({});
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      const result = await storage.allItems();
      expect(result).toEqual({});
    });

    it('returns a copy of the cached data without additional network requests', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key1: 'value1', key2: 'value2' } } },
        } as FetchResponse)
      );
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      // Prime the cache
      await storage.getItem('key1');
      request.mockReset();
      // allItems should use the cache
      const result = await storage.allItems();
      expect(request).not.toHaveBeenCalled();
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('returns data reflecting updates from setItem', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { spec: { data: { key1: 'old' } } },
        } as FetchResponse)
      );
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));
      const storage = renderHook(() => usePluginUserStorage()).result.current;
      await storage.setItem('key1', 'new');
      request.mockReset();
      const result = await storage.allItems();
      expect(request).not.toHaveBeenCalled();
      expect(result).toEqual({ key1: 'new' });
    });
  });

  describe('updateItem', () => {
    const url = '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/svc:abc';
    const fetched = (resourceVersion: string, data: Record<string, string>) =>
      Promise.resolve({ status: 200, data: { metadata: { resourceVersion }, spec: { data } } } as FetchResponse);
    const ok = () => Promise.resolve({ status: 200 } as FetchResponse);
    const fail = (status: number) => () => Promise.reject({ status } as FetchError);

    it('patches with the fetched resourceVersion and caches the result', async () => {
      request.mockImplementation((options) => (options.method === 'GET' ? fetched('7', { key: 'a' }) : ok()));
      const storage = new UserStorage('svc');

      await storage.updateItem('key', (current) => current + 'b');

      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url,
          method: 'PATCH',
          data: { metadata: { resourceVersion: '7' }, spec: { data: { key: 'ab' } } },
        })
      );
      request.mockClear();
      expect(await storage.getItem('key')).toBe('ab');
      expect(request).not.toHaveBeenCalled();
    });

    it('re-reads and re-runs update after a version conflict', async () => {
      const update = jest.fn((current: string | null) => `${current}!`);
      request
        .mockReturnValueOnce(fetched('7', { key: 'a' }))
        .mockImplementationOnce(fail(409))
        .mockReturnValueOnce(fetched('8', { key: 'z' }))
        .mockReturnValueOnce(ok());

      await new UserStorage('svc').updateItem('key', update);

      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenNthCalledWith(2, 'z');
      expect(request).toHaveBeenCalledTimes(4);
      expect(request).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          method: 'PATCH',
          data: { metadata: { resourceVersion: '8' }, spec: { data: { key: 'z!' } } },
        })
      );
    });

    it('gives up after three conflicts', async () => {
      request.mockImplementation((options) => (options.method === 'GET' ? fetched('7', { key: 'a' }) : fail(409)()));

      await expect(new UserStorage('svc').updateItem('key', () => 'b')).rejects.toThrow(
        'User storage: conflicting writes'
      );
      expect(request).toHaveBeenCalledTimes(6);
    });

    it('creates the resource when none exists', async () => {
      request.mockImplementationOnce(fail(404)).mockReturnValueOnce(ok());
      const update = jest.fn(() => 'first');

      await new UserStorage('svc').updateItem('key', update);

      expect(update).toHaveBeenCalledWith(null);
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/',
          method: 'POST',
          data: {
            metadata: { name: 'svc:abc', labels: { user: 'abc', service: 'svc' } },
            spec: { data: { key: 'first' } },
          },
        })
      );
    });

    it('patches the resource another client created first', async () => {
      request
        .mockImplementationOnce(fail(404))
        .mockImplementationOnce(fail(409))
        .mockReturnValueOnce(fetched('3', {}))
        .mockReturnValueOnce(ok());

      await new UserStorage('svc').updateItem('key', () => 'v');

      expect(request).toHaveBeenCalledTimes(4);
      expect(request).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          url,
          method: 'PATCH',
          data: { metadata: { resourceVersion: '3' }, spec: { data: { key: 'v' } } },
        })
      );
    });

    it('writes nothing when update returns undefined and refreshes the cache', async () => {
      request.mockReturnValueOnce(fetched('7', { key: 'stored' }));
      const storage = new UserStorage('svc');

      await storage.updateItem('key', () => undefined);

      expect(request).toHaveBeenCalledTimes(1);
      expect(await storage.getItem('key')).toBe('stored');
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('rejects on a failed write without falling back to localStorage', async () => {
      request.mockReturnValueOnce(fetched('7', { key: 'a' })).mockImplementationOnce(fail(500));

      await expect(new UserStorage('svc').updateItem('key', () => 'b')).rejects.toEqual({ status: 500 });
      expect(getStoreMocks().set).not.toHaveBeenCalled();
    });

    it('refreshes the cache from the fetched resource even when the write fails', async () => {
      const storage = new UserStorage('svc');
      request.mockReturnValueOnce(fetched('6', { key: 'old' }));
      expect(await storage.getItem('key')).toBe('old');
      request.mockReturnValueOnce(fetched('7', { key: 'fresh' })).mockImplementationOnce(fail(500));

      await expect(storage.updateItem('key', () => 'next')).rejects.toEqual({ status: 500 });

      expect(await storage.getItem('key')).toBe('fresh');
      expect(request).toHaveBeenCalledTimes(3);
    });

    it('uses localStorage in one step when the user is not signed in', async () => {
      config.bootData.user.isSignedIn = false;
      getStoreMocks().get.mockReturnValue('old');
      const update = jest.fn(() => 'new');

      await new UserStorage('svc').updateItem('key', update);

      expect(getStoreMocks().get).toHaveBeenCalledWith('svc:abc:key');
      expect(update).toHaveBeenCalledWith('old');
      expect(getStoreMocks().set).toHaveBeenCalledWith('svc:abc:key', 'new');
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe('operation queue', () => {
    it('runs queued operations one after another', async () => {
      const deferred = <T,>() => {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((r) => (resolve = r));
        return { promise, resolve };
      };
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
      const firstGet = deferred<FetchResponse>();
      const patchB = deferred<FetchResponse>();
      const updateC = jest.fn(() => 'c');
      let patches = 0;
      request.mockImplementation((options) => {
        if (options.method === 'GET') {
          return request.mock.calls.length === 1
            ? firstGet.promise
            : Promise.resolve({
                status: 200,
                data: { metadata: { resourceVersion: '1' }, spec: { data: {} } },
              } as FetchResponse);
        }
        patches++;
        return patches === 1 ? patchB.promise : Promise.resolve({ status: 200 } as FetchResponse);
      });
      const storage = new UserStorage('svc');

      const a = storage.getItem('key');
      const b = storage.updateItem('key', () => 'b');
      const c = storage.updateItem('key', updateC);
      await flush();
      // A holds the lock on its pending GET; B and C are queued.
      expect(request).toHaveBeenCalledTimes(1);

      firstGet.resolve({
        status: 200,
        data: { metadata: { resourceVersion: '0' }, spec: { data: {} } },
      } as FetchResponse);
      await flush();
      // B fetched and is waiting on its PATCH; C has not started.
      expect(request).toHaveBeenCalledTimes(3);
      expect(updateC).not.toHaveBeenCalled();

      patchB.resolve({ status: 200 } as FetchResponse);
      await Promise.all([a, b, c]);
      expect(updateC).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(5);
    });
  });

  describe('Cache behavior', () => {
    it('multiple instances share the same network request', async () => {
      request.mockReturnValue(
        Promise.resolve({ status: 200, data: { spec: { data: { key: 'value' } } } } as FetchResponse)
      );
      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;

      // Both should call getItem concurrently
      const [value1, value2] = await Promise.all([storage1.getItem('key'), storage2.getItem('key')]);

      // Should only make one network request
      expect(request).toHaveBeenCalledTimes(1);
      expect(value1).toBe('value');
      expect(value2).toBe('value');
    });

    it('caches 404 responses to avoid multiple requests', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;

      // Both should call getItem concurrently
      await Promise.all([storage1.getItem('key'), storage2.getItem('key')]);

      // Should only make one network request despite multiple instances
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('updates cache after creating new storage', async () => {
      // First call: 404, then create
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      request.mockReturnValueOnce(Promise.resolve({ status: 200 } as FetchResponse));

      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      await storage1.setItem('key1', 'value1');

      // Second instance should use cached data without network request
      request.mockReset();
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;
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

      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      await storage1.setItem('key1', 'new-value1');

      // Second instance should get updated value from cache
      request.mockReset();
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;
      const value = await storage2.getItem('key1');

      // Should not make a GET request because cache has the updated data
      expect(request).not.toHaveBeenCalled();
      expect(value).toBe('new-value1');
    });

    it('concurrent first reads make one request', async () => {
      let resolvePromise: (value: FetchResponse | FetchError) => void;
      const promise = new Promise<FetchResponse | FetchError>((resolve) => {
        resolvePromise = resolve;
      });

      request.mockReturnValue(promise);

      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;

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

      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;

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

      const storage1 = renderHook(() => usePluginUserStorage()).result.current;
      const storage2 = renderHook(() => usePluginUserStorage()).result.current;

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

describe('useUserStorage', () => {
  it('returns the same instance across re-renders', () => {
    const { result, rerender } = renderHook(() => useUserStorage('my-service'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns a new instance when the service name changes', () => {
    const { result, rerender } = renderHook(({ service }) => useUserStorage(service), {
      initialProps: { service: 'service-a' },
    });
    const first = result.current;
    rerender({ service: 'service-b' });
    expect(result.current).not.toBe(first);
  });
});

describe('usePluginUserStorage', () => {
  it('returns the same instance across re-renders', () => {
    const { result, rerender } = renderHook(() => usePluginUserStorage());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns a new instance when the plugin id changes', () => {
    const { usePluginContext } = require('@grafana/data');
    const originalImpl = usePluginContext.getMockImplementation();

    try {
      const { result, rerender } = renderHook(() => usePluginUserStorage());
      const first = result.current;

      usePluginContext.mockReturnValue({ meta: { id: 'other-plugin' } });
      rerender();
      expect(result.current).not.toBe(first);
    } finally {
      usePluginContext.mockImplementation(originalImpl);
    }
  });

  it('should throw error when used outside plugin context', () => {
    const { usePluginContext } = require('@grafana/data');
    const originalImpl = usePluginContext.getMockImplementation();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      usePluginContext.mockReturnValue(null);

      expect(() => {
        renderHook(() => usePluginUserStorage());
      }).toThrow('No PluginContext found. The usePluginUserStorage() hook can only be used from a plugin.');
    } finally {
      usePluginContext.mockImplementation(originalImpl);
      consoleSpy.mockRestore();
    }
  });
});
