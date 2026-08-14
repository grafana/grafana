import { setTestFlags } from '@grafana/test-utils/unstable';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { setLogger, initializeLoggersRegistry } from '../logging/registry';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { myOrgTestAppMeta } from '../pluginMeta/test-fixtures/v0alpha1Response';

import { getPluginSettings } from './getPluginSettings';
import { invalidatePluginSettingsCache } from './invalidatePluginSettingsCache';
import { legacyMyOrgTestAppSettings } from './test-fixtures/legacy.settings';
import { myOrgTestAppSettings } from './test-fixtures/v0alpha1Response';

jest.mock('../pluginMeta/plugins', () => ({
  ...jest.requireActual('../pluginMeta/plugins'),
  getPluginMetaFromCache: jest.fn(),
}));

const getPluginMetaFromCacheMock = jest.mocked(getPluginMetaFromCache);

describe('invalidatePluginSettingsCache', () => {
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
      setTestFlags({ 'plugins.useMTPluginSettings': true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    beforeEach(() => {
      getPluginMetaFromCacheMock.mockResolvedValue(myOrgTestAppMeta);
      backendSrv.get = jest.fn().mockResolvedValue(myOrgTestAppSettings);
    });

    it('should invalidate the cache so subsequent calls fetch settings again', async () => {
      // new fetch call
      await getPluginSettings(legacyMyOrgTestAppSettings.id);

      // cached call
      await getPluginSettings(legacyMyOrgTestAppSettings.id);

      // clears cache
      invalidatePluginSettingsCache(legacyMyOrgTestAppSettings.id);

      // new fetch call
      await getPluginSettings(legacyMyOrgTestAppSettings.id);

      expect(backendSrv.get).toHaveBeenCalledTimes(2);
      expect(backendSrv.get).toHaveBeenCalledWith(
        '/apis/myorg-test-app/v0alpha1/namespaces/default/app/instance',
        undefined,
        undefined,
        {
          showErrorAlert: false,
          validatePath: true,
        }
      );
    });

    it('should silently no-op when no cache entry exists for the plugin id', async () => {
      expect(() => invalidatePluginSettingsCache('myorg-test-app')).not.toThrow();
      expect(backendSrv.get).not.toHaveBeenCalled();
    });
  });

  describe('when plugins.useMTPluginSettings flag is disabled', () => {
    beforeAll(() => {
      setTestFlags({ 'plugins.useMTPluginSettings': false });
    });

    afterAll(() => {
      setTestFlags({});
    });

    beforeEach(() => {
      backendSrv.get = jest.fn().mockResolvedValue(legacyMyOrgTestAppSettings);
    });

    it('should invalidate the cache so subsequent calls fetch settings again', async () => {
      // new fetch call
      await getPluginSettings(legacyMyOrgTestAppSettings.id);

      // cached call
      await getPluginSettings(legacyMyOrgTestAppSettings.id);

      // clears cache
      invalidatePluginSettingsCache(legacyMyOrgTestAppSettings.id);

      // new fetch call
      await getPluginSettings(legacyMyOrgTestAppSettings.id);

      expect(backendSrv.get).toHaveBeenCalledTimes(2);
      expect(backendSrv.get).toHaveBeenCalledWith('/api/plugins/myorg-test-app/settings', undefined, undefined, {
        showErrorAlert: false,
        validatePath: true,
      });
    });

    it('should silently no-op when no cache entry exists for the plugin id', async () => {
      expect(() => invalidatePluginSettingsCache('myorg-test-app')).not.toThrow();
      expect(backendSrv.get).not.toHaveBeenCalled();
    });
  });
});
