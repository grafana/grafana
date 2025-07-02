import { cloneDeep } from 'lodash';
import { of } from 'rxjs';

import { config } from '../config';
import { BackendSrvRequest, FetchError, FetchResponse, BackendSrv } from '../services';

import { usePluginUserStorage } from './userStorage';

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

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  usePluginContext: jest.fn().mockReturnValue({ meta: { id: 'plugin-id' } }),
}));

describe('userStorage', () => {
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalConfig = cloneDeep(config);

  beforeEach(() => {
    config.bootData.user.isSignedIn = true;
    config.bootData.user.uid = 'abc';
    request.mockReset();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.getItem = jest.fn();
  });

  afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
    Storage.prototype.getItem = originalGetItem;
    config.featureToggles = originalConfig.featureToggles;
    config.bootData = originalConfig.bootData;
  });

  describe('UserStorageAPI.getItem', () => {
    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      const storage = usePluginUserStorage();
      await storage.getItem('key');
      expect(localStorage.getItem).toHaveBeenCalledWith('plugin-id:abc:key');
    });

    it('use localStorage if the user storage is not found', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      const storage = usePluginUserStorage();
      await storage.getItem('key');
      expect(localStorage.getItem).toHaveBeenCalledWith('plugin-id:abc:key');
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
      expect(localStorage.setItem).toHaveBeenCalledWith('plugin-id:abc:key', 'value');
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
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('falls back to localStorage if the user storage fails to be created', async () => {
      // Get fails with not found
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      // Create fails with forbidden
      request.mockReturnValueOnce(Promise.reject({ status: 403 } as FetchError));
      const storage = usePluginUserStorage();
      await storage.setItem('key', 'value');
      expect(localStorage.setItem).toHaveBeenCalledWith('plugin-id:abc:key', 'value');
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
  });
});
