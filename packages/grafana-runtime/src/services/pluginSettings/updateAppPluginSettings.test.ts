import { type CurrentUserDTO, OrgRole } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { config } from '../../config';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { invalidateCachedPromisesCache, getCachedPromise } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';
import { getAPIGroup, invalidateAPIDiscovery, setAPIDiscoveryForTesting } from '../apiDiscovery/discovery';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { setLogger, initializeLoggersRegistry } from '../logging/registry';
import { getPluginMetaFromCache, refetchPluginMeta } from '../pluginMeta/plugins';
import { clockPanelMetaOnPrem, myOrgTestAppMeta, v0alpha1Response } from '../pluginMeta/test-fixtures/v0alpha1Response';
import { getCacheKey } from '../pluginUtils';

import { legacyMyOrgTestAppSettings } from './test-fixtures/legacy.settings';
import { clockPanelOnPremPluginMeta, myOrgTestAppSettings, testdataPluginMeta } from './test-fixtures/v0alpha1Response';
import { type Settings as v0alpha1Settings } from './types';
import { updateAppPluginSettings } from './updateAppPluginSettings';

jest.mock('../pluginMeta/plugins', () => ({
  ...jest.requireActual('../pluginMeta/plugins'),
  getPluginMetaFromCache: jest.fn(),
  refetchPluginMeta: jest.fn(),
}));

const getPluginMetaFromCacheMock = jest.mocked(getPluginMetaFromCache);
const refetchPluginMetaMock = jest.mocked(refetchPluginMeta);
const testdata = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'grafana-testdata-datasource')!;

describe('settings', () => {
  let backendSrv: BackendSrv;
  let logger: MonitoringLogger;

  beforeAll(() => {
    initializeLoggersRegistry();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCachedPromisesCache();
    backendSrv = {
      chunked: jest.fn(),
      delete: jest.fn(),
      fetch: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      datasourceRequest: jest.fn(),
      request: jest.fn(),
    };
    setBackendSrv(backendSrv);
    logger = {
      logDebug: jest.fn(),
      logError: jest.fn(),
      logInfo: jest.fn(),
      logMeasurement: jest.fn(),
      logWarning: jest.fn(),
    };
    setLogger('grafana/runtime.plugins.settings', logger);
  });

  describe('when plugins.useMTPluginSettings flag is enabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPluginSettings]: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    beforeEach(() => {
      getPluginMetaFromCacheMock.mockResolvedValue(myOrgTestAppMeta);
      refetchPluginMetaMock.mockResolvedValue(myOrgTestAppMeta);
      backendSrv.get = jest.fn().mockResolvedValue(myOrgTestAppSettings);
    });

    describe('updateAppPluginSettings', () => {
      it('should update settings from new apis', async () => {
        // stored value
        backendSrv.get = jest.fn().mockResolvedValue({
          ...myOrgTestAppSettings,
          spec: { enabled: true, pinned: true, jsonData: { apiUrl: 'https://www.grafana.com/' } },
          secure: {
            apiKey: { name: 'some-secret-apiKey' },
            password: { name: 'some-secret-password' },
          },
        });

        // value after patch
        backendSrv.patch = jest.fn().mockResolvedValue({
          ...myOrgTestAppSettings,
          spec: { enabled: false, pinned: false, jsonData: { apiUrl: 'https://grafana.com/' } },
          secure: {
            apiKey: { name: 'some-secret-apiKey' },
            newKey: { name: 'some-secret-newKey' },
          },
        });

        const response = await updateAppPluginSettings(myOrgTestAppSettings.metadata.name, {
          enabled: false,
          pinned: false,
          jsonData: { apiUrl: 'https://grafana.com/' },
          secureJsonData: { apiKey: 'the api key', newKey: 'the new key' },
          secureJsonFields: { apiKey: true, password: false },
        });

        expect(response).toMatchObject({
          ...legacyMyOrgTestAppSettings,
          enabled: false,
          pinned: false,
          jsonData: { apiUrl: 'https://grafana.com/' },
          secureJsonFields: { apiKey: true, newKey: true },
        });
        expect(refetchPluginMetaMock).toHaveBeenCalledTimes(1);
        expect(backendSrv.patch).toHaveBeenCalledTimes(1);
        expect(backendSrv.patch).toHaveBeenCalledWith(
          '/apis/myorg-test-app/v0alpha1/namespaces/default/app/instance',
          [
            { op: 'test', path: '/metadata/resourceVersion', value: '' },
            { op: 'remove', path: '/secure/password/name' },
            {
              op: 'add',
              path: '/secure/password/remove',
              value: true,
            },
            { op: 'remove', path: '/secure/apiKey/name' },
            {
              op: 'add',
              path: '/secure/apiKey/create',
              value: 'the api key',
            },
            {
              op: 'add',
              path: '/secure/newKey',
              value: {
                create: 'the new key',
              },
            },
            {
              op: 'replace',
              path: '/spec/jsonData/apiUrl',
              value: 'https://grafana.com/',
            },
            {
              op: 'replace',
              path: '/spec/pinned',
              value: false,
            },
            {
              op: 'replace',
              path: '/spec/enabled',
              value: false,
            },
          ],
          { validatePath: true, headers: { 'Content-Type': 'application/json-patch+json' } }
        );
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/myorg-test-app/v0alpha1/namespaces/default/app/instance',
          undefined,
          undefined,
          { showErrorAlert: false, validatePath: true }
        );
      });

      it('should cache updated settings from new apis', async () => {
        // stored value
        backendSrv.get = jest.fn().mockResolvedValue({
          ...myOrgTestAppSettings,
          spec: { enabled: true, pinned: true, jsonData: { apiUrl: 'https://www.grafana.com/' } },
          secure: {
            apiKey: { name: 'some-secret-apiKey' },
            password: { name: 'some-secret-password' },
          },
        });

        // value after patch
        backendSrv.patch = jest.fn().mockResolvedValue({
          ...myOrgTestAppSettings,
          spec: { enabled: false, pinned: false, jsonData: { apiUrl: 'https://grafana.com/' } },
          secure: {
            apiKey: { name: 'some-secret-apiKey' },
            newKey: { name: 'some-secret-newKey' },
          },
        });

        const before = await getCachedPromise(async () => {}, { cacheKey: 'getAppPluginSettings-myorg-test-app' });
        const response = await updateAppPluginSettings(myOrgTestAppSettings.metadata.name, {
          enabled: false,
          pinned: false,
          jsonData: { apiUrl: 'https://grafana.com/' },
          secureJsonData: { apiKey: 'the api key', newKey: 'the new key' },
          secureJsonFields: { apiKey: true, password: false },
        });
        const cached = await getCachedPromise(async () => ({}) as v0alpha1Settings, {
          cacheKey: getCacheKey('myorg-test-app'),
        });

        expect(before).not.toBe(cached);
        expect(response?.enabled).toBe(cached.spec.enabled);
        expect(response?.pinned).toBe(cached.spec.pinned);
        expect(response?.jsonData).toBe(cached.spec.jsonData);
        expect(cached?.secure).toEqual({
          apiKey: { name: 'some-secret-apiKey' },
          newKey: { name: 'some-secret-newKey' },
        });
      });

      it('should just map panel plugins', async () => {
        refetchPluginMetaMock.mockResolvedValue(clockPanelMetaOnPrem);

        const result = await updateAppPluginSettings(clockPanelMetaOnPrem.spec.pluginJson.id, {});

        expect(result).toEqual(clockPanelOnPremPluginMeta);
        expect(backendSrv.post).not.toHaveBeenCalled();
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should just map data source plugins', async () => {
        refetchPluginMetaMock.mockResolvedValue(testdata);

        const result = await updateAppPluginSettings(testdata.spec.pluginJson.id, {});

        expect(result).toEqual(testdataPluginMeta);
        expect(backendSrv.post).not.toHaveBeenCalled();
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should throw when meta is null', async () => {
        refetchPluginMetaMock.mockResolvedValue(null);
        backendSrv.post = jest.fn().mockResolvedValue(undefined);
        backendSrv.get = jest.fn().mockResolvedValue(legacyMyOrgTestAppSettings);

        const response = await updateAppPluginSettings(legacyMyOrgTestAppSettings.id, { enabled: true });

        expect(response).toEqual(legacyMyOrgTestAppSettings);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
          showErrorAlert: false,
          validatePath: true,
        });
        expect(backendSrv.post).toHaveBeenCalledTimes(1);
        expect(backendSrv.post).toHaveBeenCalledWith(
          '/api/plugins/myorg-test-app/settings',
          { enabled: true },
          { validatePath: true }
        );
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(updateAppPluginSettings('text/secret?x=', { enabled: true })).rejects.toThrow(
          'Invalid plugin ID \"text/secret?x=\"'
        );

        expect(backendSrv.get).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('when plugins.useMTPluginSettings flag is disabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPluginSettings]: false });
    });

    afterAll(() => {
      setTestFlags({});
    });

    beforeEach(() => {
      backendSrv.get = jest.fn().mockResolvedValue(legacyMyOrgTestAppSettings);
    });

    describe('updateAppPluginSettings', () => {
      it('should update settings from new apis', async () => {
        backendSrv.post = jest.fn().mockResolvedValue(undefined);

        const response = await updateAppPluginSettings(myOrgTestAppSettings.metadata.name, {
          enabled: false,
          pinned: false,
          jsonData: { apiUrl: 'https://grafana.com/' },
          secureJsonData: { apiKey: 'the api key', password: 'the password', newKey: 'the new key' },
          secureJsonFields: { apiKey: true, password: false },
        });

        expect(response).toMatchObject(legacyMyOrgTestAppSettings);
        expect(backendSrv.post).toHaveBeenCalledTimes(1);
        expect(backendSrv.post).toHaveBeenCalledWith(
          '/api/plugins/myorg-test-app/settings',
          {
            enabled: false,
            pinned: false,
            jsonData: { apiUrl: 'https://grafana.com/' },
            secureJsonData: { apiKey: 'the api key', password: 'the password', newKey: 'the new key' },
            secureJsonFields: { apiKey: true, password: false },
          },
          { validatePath: true }
        );
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
          showErrorAlert: false,
          validatePath: true,
        });
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(updateAppPluginSettings('text/secret?x=', { enabled: true })).rejects.toThrow(
          'Invalid plugin ID \"text/secret?x=\"'
        );

        expect(backendSrv.get).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('API discovery', () => {
    const originalUser = config.bootData.user;
    const cachedGroup = { group: 'myorg-test-app', versions: ['v0alpha1'], preferredVersion: 'v0alpha1' };
    const serverGroupList = {
      groups: [
        {
          name: 'myorg-test-app',
          versions: [{ groupVersion: 'myorg-test-app/v1', version: 'v1' }],
          preferredVersion: { groupVersion: 'myorg-test-app/v1', version: 'v1' },
        },
      ],
    };

    // The cache and the server disagree on the preferred version, so the answer shows which one discovery used.
    async function discoveredPreferredVersion(): Promise<string | undefined> {
      backendSrv.get = jest.fn().mockResolvedValue(serverGroupList);
      return (await getAPIGroup(cachedGroup.group))?.preferredVersion;
    }

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      config.bootData.user = { isSignedIn: true, orgRole: OrgRole.Admin } as CurrentUserDTO;
      setAPIDiscoveryForTesting([cachedGroup]);
    });

    afterEach(() => {
      config.bootData.user = originalUser;
      invalidateAPIDiscovery();
    });

    describe.each([
      ['enabled', true],
      ['disabled', false],
    ])('when plugins.useMTPluginSettings flag is %s', (_, useMTPluginSettings) => {
      beforeAll(() => {
        setTestFlags({ [FlagKeys.PluginsUseMTPluginSettings]: useMTPluginSettings });
      });

      afterAll(() => {
        setTestFlags({});
      });

      beforeEach(() => {
        refetchPluginMetaMock.mockResolvedValue(myOrgTestAppMeta);
        backendSrv.get = jest
          .fn()
          .mockResolvedValue(useMTPluginSettings ? myOrgTestAppSettings : legacyMyOrgTestAppSettings);
        backendSrv.patch = jest.fn().mockResolvedValue(myOrgTestAppSettings);
        backendSrv.post = jest.fn().mockResolvedValue(undefined);
      });

      it.each([true, false])('asks the server again after setting enabled to %s', async (enabled) => {
        await updateAppPluginSettings(cachedGroup.group, { enabled });

        await expect(discoveredPreferredVersion()).resolves.toBe('v1');
      });

      it('keeps the cached answer when the update does not set enabled', async () => {
        await updateAppPluginSettings(cachedGroup.group, { jsonData: { apiUrl: 'https://grafana.com/' } });

        await expect(discoveredPreferredVersion()).resolves.toBe('v0alpha1');
      });

      it('keeps the cached answer when the update fails', async () => {
        const failure = new Error('update failed');
        backendSrv.patch = jest.fn().mockRejectedValue(failure);
        backendSrv.post = jest.fn().mockRejectedValue(failure);

        await expect(updateAppPluginSettings(cachedGroup.group, { enabled: true })).rejects.toBe(failure);

        await expect(discoveredPreferredVersion()).resolves.toBe('v0alpha1');
      });
    });

    describe('when the plugin meta is missing and the update falls back to the legacy API', () => {
      beforeAll(() => {
        setTestFlags({ [FlagKeys.PluginsUseMTPluginSettings]: true });
      });

      afterAll(() => {
        setTestFlags({});
      });

      it('asks the server again after setting enabled', async () => {
        refetchPluginMetaMock.mockResolvedValue(null);
        backendSrv.post = jest.fn().mockResolvedValue(undefined);
        backendSrv.get = jest.fn().mockResolvedValue(legacyMyOrgTestAppSettings);

        await updateAppPluginSettings(cachedGroup.group, { enabled: true });

        await expect(discoveredPreferredVersion()).resolves.toBe('v1');
      });
    });
  });
});
