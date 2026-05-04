import { setTestFlags } from '@grafana/test-utils/unstable';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { setLogger, initializeLoggersRegistry } from '../logging/registry';
import { getPluginMetaFromCache, refetchPluginMeta } from '../pluginMeta/plugins';
import { clockPanelMetaOnPrem, myOrgTestAppMeta } from '../pluginMeta/test-fixtures/v0alpha1Response';

import { isAppPluginEnabled } from './settings';
import { legacyClockPanelOnPrem, legacyMyOrgTestAppSettings } from './test-fixtures/legacy.settings';
import { myOrgTestAppSettings } from './test-fixtures/v0alpha1Response';

jest.mock('../pluginMeta/plugins', () => ({
  ...jest.requireActual('../pluginMeta/plugins'),
  getPluginMetaFromCache: jest.fn(),
  refetchPluginMeta: jest.fn(),
}));

const getPluginMetaFromCacheMock = jest.mocked(getPluginMetaFromCache);
const refetchPluginMetaMock = jest.mocked(refetchPluginMeta);

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
