import { setTestFlags } from '@grafana/test-utils/unstable';

import { invalidateCachedPromisesCache, getCachedPromise } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { setLogger, initializeLoggersRegistry } from '../logging/registry';
import { getPluginMetaFromCache, refetchPluginMeta } from '../pluginMeta/plugins';
import { clockPanelMetaOnPrem, myOrgTestAppMeta, v0alpha1Response } from '../pluginMeta/test-fixtures/v0alpha1Response';

import { legacyMyOrgTestAppSettings } from './test-fixtures/legacy.settings';
import {
  clockPanelOnPremPluginMeta,
  cloudwatchPluginMeta,
  myOrgTestAppSettings,
} from './test-fixtures/v0alpha1Response';
import { type Settings as v0alpha1Settings } from './types';
import { updateAppPluginSettings } from './updateAppPluginSettings';
import { getCacheKey } from './utils';

jest.mock('../pluginMeta/plugins', () => ({
  ...jest.requireActual('../pluginMeta/plugins'),
  getPluginMetaFromCache: jest.fn(),
  refetchPluginMeta: jest.fn(),
}));

const getPluginMetaFromCacheMock = jest.mocked(getPluginMetaFromCache);
const refetchPluginMetaMock = jest.mocked(refetchPluginMeta);
const cloudwatch = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'cloudwatch')!;

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

  describe('when useMTPluginSettings flag is enabled', () => {
    beforeAll(() => {
      setTestFlags({ useMTPluginSettings: true });
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
          '/apis/myorg-test-app.grafana.app/v0alpha1/namespaces/default/settings/myorg-test-app',
          [
            { op: 'test', path: '/metadata/resourceVersion', value: '' },
            { op: 'remove', path: '/secure/password/name' },
            {
              op: 'add',
              path: '/secure/password/remove',
              value: true,
            },
            {
              op: 'replace',
              path: '/secure/apiKey/name',
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
          '/apis/myorg-test-app.grafana.app/v0alpha1/namespaces/default/settings/myorg-test-app',
          undefined,
          undefined,
          { validatePath: true }
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
        refetchPluginMetaMock.mockResolvedValue(cloudwatch);

        const result = await updateAppPluginSettings(cloudwatch.spec.pluginJson.id, {});

        expect(result).toEqual(cloudwatchPluginMeta);
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
          validatePath: true,
        });
        expect(backendSrv.post).toHaveBeenCalledTimes(1);
        expect(backendSrv.post).toHaveBeenCalledWith(
          '/api/plugins/myorg-test-app/settings',
          { enabled: true },
          { validatePath: true }
        );
      });
    });
  });

  describe('when useMTPluginSettings flag is disabled', () => {
    beforeAll(() => {
      setTestFlags({ useMTPluginSettings: false });
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
          validatePath: true,
        });
      });
    });
  });
});
