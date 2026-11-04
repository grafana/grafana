import { applyPatch, type Operation } from 'fast-json-patch';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { invalidateCachedPromisesCache, getCachedPromise } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';
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

      describe('secrets are merged like the legacy API: omitted secrets are kept', () => {
        const stored: v0alpha1Settings = {
          ...myOrgTestAppSettings,
          spec: { enabled: true, pinned: true, jsonData: { apiUrl: 'https://www.grafana.com/' } },
          secure: {
            apiKey: { name: 'some-secret-apiKey' },
            password: { name: 'some-secret-password' },
          },
        };

        // Asserts on the document the server ends up with, not on the shape of the patch.
        async function updateAndApplyPatch(data: Parameters<typeof updateAppPluginSettings>[1]) {
          backendSrv.get = jest.fn().mockResolvedValue(stored);
          backendSrv.patch = jest.fn().mockResolvedValue(stored);

          await updateAppPluginSettings(myOrgTestAppSettings.metadata.name, data);

          const [, patch] = jest.mocked(backendSrv.patch).mock.calls[0];
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return applyPatch(structuredClone(stored), patch as Operation[]).newDocument;
        }

        it('should keep all stored secrets when secureJsonData is omitted', async () => {
          const result = await updateAndApplyPatch({ jsonData: { apiUrl: 'https://grafana.com/' } });

          expect(result.secure).toEqual(stored.secure);
          expect(result.spec.jsonData).toEqual({ apiUrl: 'https://grafana.com/' });
        });

        it('should keep stored secrets that are not part of secureJsonData', async () => {
          const result = await updateAndApplyPatch({
            jsonData: { apiUrl: 'https://grafana.com/' },
            secureJsonData: { apiKey: 'the new api key' },
            secureJsonFields: { apiKey: true, password: true },
          });

          expect(result.secure).toEqual({
            apiKey: { create: 'the new api key' },
            password: { name: 'some-secret-password' },
          });
        });

        it('should only remove a secret that is explicitly marked for removal', async () => {
          const result = await updateAndApplyPatch({
            jsonData: { apiUrl: 'https://grafana.com/' },
            secureJsonFields: { apiKey: true, password: false },
          });

          expect(result.secure).toEqual({
            apiKey: { name: 'some-secret-apiKey' },
            password: { remove: true },
          });
        });

        it('should save a new secret when the key was reset and then retyped', async () => {
          const result = await updateAndApplyPatch({
            secureJsonData: { apiKey: 'the new api key' },
            secureJsonFields: { apiKey: false, password: true },
          });

          expect(result.secure).toEqual({
            apiKey: { create: 'the new api key' },
            password: { name: 'some-secret-password' },
          });
        });
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
    });
  });
});
