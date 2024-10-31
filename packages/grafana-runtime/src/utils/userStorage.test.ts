import { cloneDeep } from 'lodash';
import { of } from 'rxjs';

import { config } from '../config';
import { BackendSrvRequest, FetchError, FetchResponse, BackendSrv } from '../services';

import { getItem, setItem } from './userStorage';

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

// jest.mock('app/features/plugins/pluginSettings', () => ({
//   getPluginSettings: jest.fn(),
// }));

// jest.mock('app/features/plugins/sandbox/sandbox_plugin_loader_registry', () => ({
//   ...jest.requireActual('app/features/plugins/sandbox/sandbox_plugin_loader_registry'),
//   isPluginFrontendSandboxEnabled: jest.fn(),
// }));

// const getPluginSettingsMock = getPluginSettings as jest.MockedFunction<typeof getPluginSettings>;
// const fakePlugin: PluginMeta = {
//   id: 'test-plugin',
//   name: 'Test Plugin',
// } as PluginMeta;

// const isPluginFrontendSandboxEnabledInOssMock = isPluginFrontendSandboxEnabled as jest.MockedFunction<
//   typeof isPluginFrontendSandboxEnabled
// >;

describe('userStorage', () => {
  // const originalNodeEnv = process.env.NODE_ENV;
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalConfig = cloneDeep(config);

  beforeEach(() => {
    config.featureToggles.userStorageAPI = true;
    config.bootData.user.isSignedIn = true;
    config.bootData.user.uid = 'abc';
    // process.env.NODE_ENV = 'development';
    // getPluginSettingsMock.mockResolvedValue({ ...fakePlugin, signatureType: PluginSignatureType.community });
    // initSandboxPluginLoaderRegistry();
    request.mockReset();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.getItem = jest.fn();
  });

  afterEach(() => {
    // process.env.NODE_ENV = originalNodeEnv;
    Storage.prototype.setItem = originalSetItem;
    Storage.prototype.getItem = originalGetItem;
    config.featureToggles = originalConfig.featureToggles;
    config.bootData = originalConfig.bootData;
  });

  describe('getItem', () => {
    it('use localStorage if the feature flag is disabled', async () => {
      config.featureToggles.userStorageAPI = false;
      getItem('key');
      expect(localStorage.getItem).toHaveBeenCalled();
    });

    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      getItem('key');
      expect(localStorage.getItem).toHaveBeenCalled();
    });

    it('use localStorage if the user storage is not found', async () => {
      request.mockReturnValue(Promise.reject({ status: 404 } as FetchError));
      await getItem('key');
      expect(localStorage.getItem).toHaveBeenCalled();
    });

    it('returns the value from the user storage', async () => {
      request.mockReturnValue(
        Promise.resolve({ status: 200, data: { spec: { serviceMap: { key: 'value' } } } } as FetchResponse)
      );
      const value = await getItem('key');
      expect(value).toBe('value');
    });
  });

  describe('setItem', () => {
    it('use localStorage if the feature flag is disabled', async () => {
      config.featureToggles.userStorageAPI = false;
      setItem('key', 'value');
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('use localStorage if the user is not logged in', async () => {
      config.bootData.user.isSignedIn = false;
      setItem('key', 'value');
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('creates a new user storage if it does not exist', async () => {
      request.mockReturnValueOnce(Promise.reject({ status: 404 } as FetchError));
      await setItem('key', 'value');
      expect(request).toHaveBeenCalledWith({
        url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/user:abc',
        method: 'GET',
        showErrorAlert: false,
      });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/',
          method: 'POST',
          data: {
            metadata: { name: 'user:abc' },
            spec: {
              serviceMap: { key: 'value' },
              UserUID: 'user:abc',
            },
          },
        })
      );
    });

    it('updates the user storage if it exists', async () => {
      request.mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          data: { metadata: { name: 'user:abc' }, spec: { serviceMap: { key: 'value' }, UserUID: 'user:abc' } },
        } as FetchResponse)
      );
      await setItem('key', 'new-value');
      expect(request).toHaveBeenCalledWith({
        url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/user:abc',
        method: 'GET',
        showErrorAlert: false,
      });
      expect(request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/apis/userstorage.grafana.app/v0alpha1/namespaces/default/user-storage/user:abc',
          method: 'PUT',
          data: {
            metadata: { name: 'user:abc' },
            spec: {
              serviceMap: { key: 'new-value' },
              UserUID: 'user:abc',
            },
          },
        })
      );
    });
  });
});
