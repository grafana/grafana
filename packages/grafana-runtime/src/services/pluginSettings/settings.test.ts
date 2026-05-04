import { setTestFlags } from '@grafana/test-utils/unstable';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { setLogger, initializeLoggersRegistry } from '../logging/registry';
import { getPluginMetaFromCache, refetchPluginMeta } from '../pluginMeta/plugins';
import { clockPanelMetaOnPrem, myOrgTestAppMeta, v0alpha1Response } from '../pluginMeta/test-fixtures/v0alpha1Response';

import { getPluginSettings, isAppPluginEnabled, refetchPluginSettings, updateAppPluginSettings } from './settings';
import { legacyClockPanelOnPrem, legacyMyOrgTestAppSettings } from './test-fixtures/legacy.settings';
import {
  clockPanelOnPremPluginMeta,
  cloudwatchPluginMeta,
  myOrgTestAppSettings,
} from './test-fixtures/v0alpha1Response';

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

    describe('getPluginSettings', () => {
      it('should fetch settings from new apis when cache is empty', async () => {
        const response = await getPluginSettings(myOrgTestAppSettings.metadata.name);

        expect(response).toMatchObject(legacyMyOrgTestAppSettings);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/myorg-test-app.grafana.app/v0alpha1/namespaces/default/settings/myorg-test-app',
          undefined,
          undefined,
          {
            validatePath: true,
          }
        );
      });

      it('should not fetch settings from new apis when cache exists', async () => {
        const resp1 = await getPluginSettings(myOrgTestAppSettings.metadata.name);
        const resp2 = await getPluginSettings(myOrgTestAppSettings.metadata.name);

        expect(resp1).toMatchObject(legacyMyOrgTestAppSettings);
        expect(resp1).toStrictEqual(resp2);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/myorg-test-app.grafana.app/v0alpha1/namespaces/default/settings/myorg-test-app',
          undefined,
          undefined,
          {
            validatePath: true,
          }
        );
      });

      it('should just map panel plugins', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(clockPanelMetaOnPrem);

        const result = await getPluginSettings(clockPanelMetaOnPrem.spec.pluginJson.id);

        expect(result).toEqual(clockPanelOnPremPluginMeta);
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should just map data source plugins', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(cloudwatch);

        const result = await getPluginSettings(cloudwatch.spec.pluginJson.id);

        expect(result).toEqual(cloudwatchPluginMeta);
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should reject with Unknown Plugin message if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getPluginSettings(myOrgTestAppSettings.metadata.name)).rejects.toEqual(
          new Error('Unknown Plugin')
        );
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getPluginSettings(myOrgTestAppSettings.metadata.name)).rejects.toEqual({
          ...error,
          isHandled: true,
        });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getPluginSettings(myOrgTestAppSettings.metadata.name)).rejects.toEqual({
          ...error,
          isHandled: true,
        });
      });

      it('should throw when meta is null', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(null);
        backendSrv.get = jest.fn().mockResolvedValue(legacyMyOrgTestAppSettings);

        await expect(() => getPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toThrow(
          'Plugin not found, no installed plugin with id myorg-test-app'
        );
      });
    });

    describe('refreshPluginSettings', () => {
      it('should always refetch settings from new apis even if there is a cache', async () => {
        const resp1 = await getPluginSettings(myOrgTestAppSettings.metadata.name);
        const resp2 = await refetchPluginSettings(myOrgTestAppSettings.metadata.name);
        const resp3 = await refetchPluginSettings(myOrgTestAppSettings.metadata.name);

        expect(resp1).toMatchObject(legacyMyOrgTestAppSettings);
        expect(resp2).toMatchObject(legacyMyOrgTestAppSettings);
        expect(resp3).toMatchObject(legacyMyOrgTestAppSettings);
        expect(backendSrv.get).toHaveBeenCalledTimes(3);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/myorg-test-app.grafana.app/v0alpha1/namespaces/default/settings/myorg-test-app',
          undefined,
          undefined,
          {
            validatePath: true,
          }
        );
      });

      it('should just map panel plugins', async () => {
        refetchPluginMetaMock.mockResolvedValue(clockPanelMetaOnPrem);

        const result = await refetchPluginSettings(clockPanelMetaOnPrem.spec.pluginJson.id);

        expect(result).toEqual(clockPanelOnPremPluginMeta);
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should use legacy apis for data source plugins', async () => {
        refetchPluginMetaMock.mockResolvedValue(cloudwatch);

        const result = await refetchPluginSettings(cloudwatch.spec.pluginJson.id);

        expect(result).toEqual(cloudwatchPluginMeta);
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should reject with Unknown Plugin message if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(refetchPluginSettings(myOrgTestAppSettings.metadata.name)).rejects.toEqual(
          new Error('Unknown Plugin')
        );
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(refetchPluginSettings(myOrgTestAppSettings.metadata.name)).rejects.toEqual({
          ...error,
          isHandled: true,
        });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(refetchPluginSettings(myOrgTestAppSettings.metadata.name)).rejects.toEqual({
          ...error,
          isHandled: true,
        });
      });

      it('should throw when meta is null', async () => {
        refetchPluginMetaMock.mockResolvedValue(null);
        backendSrv.get = jest.fn().mockResolvedValue(legacyMyOrgTestAppSettings);

        await expect(() => refetchPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toThrow(
          'Plugin not found, no installed plugin with id myorg-test-app'
        );
      });
    });

    describe('updateAppPluginSettings', () => {
      it('should update settings from new apis', async () => {
        // stored value
        backendSrv.get = jest.fn().mockResolvedValue({
          ...myOrgTestAppSettings,
          spec: { enabled: true, pinned: true, jsonData: { apiUrl: 'https://www.grafana.com/' } },
          secure: {
            apiKey: { name: 'lps-sv-48fe6a860af4f72f3eefd0032e207ea1f942fcc88693411993ff778462867d27' },
            password: { name: 'lps-sv-48fe6a860af4f72f3eefd0032e207ea1f942fcc88693411993ff778462867d27' },
          },
        });

        // value after patch
        backendSrv.patch = jest.fn().mockResolvedValue({
          ...myOrgTestAppSettings,
          spec: { enabled: false, pinned: false, jsonData: { apiUrl: 'https://grafana.com/' } },
          secure: {
            apiKey: { name: 'lps-sv-48fe6a860af4f72f3eefd0032e207ea1f942fcc88693411993ff778462867d27' },
            newKey: { name: 'lps-sv-48fe6a860af4f72f3eefd0032e207ea1f942fcc88693411993ff778462867d27' },
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

        await expect(() => updateAppPluginSettings(legacyMyOrgTestAppSettings.id, { enabled: true })).rejects.toThrow(
          'Plugin not found, no installed plugin with id myorg-test-app'
        );
      });
    });

    describe('isAppPluginEnabled', () => {
      it('should return true if app exists and is enabled', async () => {
        const enabled = await isAppPluginEnabled(myOrgTestAppMeta.spec.pluginJson.id);

        expect(enabled).toEqual(true);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/myorg-test-app.grafana.app/v0alpha1/namespaces/default/settings/myorg-test-app',
          undefined,
          undefined,
          {
            validatePath: true,
          }
        );
      });

      it('should return false if app exists and is disabled', async () => {
        backendSrv.get = jest
          .fn()
          .mockResolvedValue({ ...myOrgTestAppSettings, spec: { ...myOrgTestAppSettings.spec, enabled: false } });

        const enabled = await isAppPluginEnabled(myOrgTestAppMeta.spec.pluginJson.id);

        expect(enabled).toEqual(false);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/myorg-test-app.grafana.app/v0alpha1/namespaces/default/settings/myorg-test-app',
          undefined,
          undefined,
          {
            validatePath: true,
          }
        );
      });

      it('should return false if app does not exists', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(null);
        backendSrv.get = jest.fn().mockResolvedValue(null);

        const enabled = await isAppPluginEnabled('myorg-someplugin-app');

        expect(enabled).toEqual(false);
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should return false if plugin id is not for an app', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(clockPanelMetaOnPrem);
        backendSrv.get = jest.fn().mockResolvedValue(legacyClockPanelOnPrem);

        const enabled = await isAppPluginEnabled(clockPanelMetaOnPrem.spec.pluginJson.id);

        expect(enabled).toEqual(false);
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should return false and log a warning if the backend rejects with auth error', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({ status: 403, message: 'Forbidden' });

        const enabled = await isAppPluginEnabled(myOrgTestAppMeta.spec.pluginJson.id);

        expect(enabled).toEqual(false);
        expect(logger.logWarning).toHaveBeenCalledWith('isAppPluginEnabled: failed because auth denied', {
          pluginId: 'myorg-test-app',
        });
        expect(logger.logError).not.toHaveBeenCalled();
      });

      it('should return false and log an error if the backend rejects with non-auth error', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({ status: 500, message: 'Internal Server Error' });

        const enabled = await isAppPluginEnabled(myOrgTestAppMeta.spec.pluginJson.id);

        expect(enabled).toEqual(false);
        expect(logger.logError).toHaveBeenCalledWith(
          expect.objectContaining({ message: `isAppPluginEnabled failed for plugin with id myorg-test-app` })
        );
        expect(logger.logWarning).not.toHaveBeenCalled();
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

    describe('getPluginSettings', () => {
      it('should fetch settings when cache is empty', async () => {
        const response = await getPluginSettings(legacyMyOrgTestAppSettings.id);

        expect(response).toEqual(legacyMyOrgTestAppSettings);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
          validatePath: true,
        });
      });

      it('should not fetch settings from new apis when cache exists', async () => {
        const resp1 = await getPluginSettings(legacyMyOrgTestAppSettings.id);
        const resp2 = await getPluginSettings(legacyMyOrgTestAppSettings.id);

        expect(resp1).toMatchObject(legacyMyOrgTestAppSettings);
        expect(resp1).toStrictEqual(resp2);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
          validatePath: true,
        });
      });

      it('should reject with Unknown Plugin message if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toEqual(new Error('Unknown Plugin'));
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toEqual({ ...error, isHandled: true });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toEqual({ ...error, isHandled: true });
      });
    });

    describe('refreshPluginSettings', () => {
      it('should always refetch settings from new apis even if there is a cache', async () => {
        const resp1 = await getPluginSettings(legacyMyOrgTestAppSettings.id);
        const resp2 = await refetchPluginSettings(legacyMyOrgTestAppSettings.id);
        const resp3 = await refetchPluginSettings(legacyMyOrgTestAppSettings.id);

        expect(resp1).toMatchObject(legacyMyOrgTestAppSettings);
        expect(resp2).toMatchObject(legacyMyOrgTestAppSettings);
        expect(resp3).toMatchObject(legacyMyOrgTestAppSettings);
        expect(backendSrv.get).toHaveBeenCalledTimes(3);
        expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
          validatePath: true,
        });
      });

      it('should reject with Unknown Plugin message if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(refetchPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toEqual(new Error('Unknown Plugin'));
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(refetchPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toEqual({
          ...error,
          isHandled: true,
        });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(refetchPluginSettings(legacyMyOrgTestAppSettings.id)).rejects.toEqual({
          ...error,
          isHandled: true,
        });
      });
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

    describe('isAppPluginEnabled', () => {
      it('should return true if app exists and is enabled', async () => {
        const enabled = await isAppPluginEnabled(legacyMyOrgTestAppSettings.id);

        expect(enabled).toEqual(true);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
          validatePath: true,
        });
      });

      it('should return false if app exists and is disabled', async () => {
        backendSrv.get = jest.fn().mockResolvedValue({ ...legacyMyOrgTestAppSettings, enabled: false });

        const enabled = await isAppPluginEnabled(legacyMyOrgTestAppSettings.id);

        expect(enabled).toEqual(false);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
          validatePath: true,
        });
      });

      it('should return false if app does not exists', async () => {
        backendSrv.get = jest.fn().mockResolvedValue(null);

        const enabled = await isAppPluginEnabled('myorg-someplugin-app');

        expect(enabled).toEqual(false);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
      });

      it('should return false if plugin id is not for an app', async () => {
        backendSrv.get = jest.fn().mockResolvedValue(legacyClockPanelOnPrem);

        const enabled = await isAppPluginEnabled(legacyClockPanelOnPrem.id);

        expect(enabled).toEqual(false);
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
      });
    });
  });
});
