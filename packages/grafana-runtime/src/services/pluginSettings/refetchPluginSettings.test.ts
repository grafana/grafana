import { setTestFlags } from '@grafana/test-utils/unstable';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { setLogger, initializeLoggersRegistry } from '../logging/registry';
import { getPluginMetaFromCache, refetchPluginMeta } from '../pluginMeta/plugins';
import { clockPanelMetaOnPrem, myOrgTestAppMeta, v0alpha1Response } from '../pluginMeta/test-fixtures/v0alpha1Response';

import { getPluginSettings } from './getPluginSettings';
import { refetchPluginSettings } from './refetchPluginSettings';
import { legacyMyOrgTestAppSettings } from './test-fixtures/legacy.settings';
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

    describe('refetchPluginSettings', () => {
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

    describe('refetchPluginSettings', () => {
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
  });
});
