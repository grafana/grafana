import { setTestFlags } from '@grafana/test-utils/unstable';

import { FlagKeys } from '../../internal';
import { TracedError } from '../../utils/TracedError';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { initializeLoggersRegistry, setLogger } from '../logging/registry';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { v0alpha1Response } from '../pluginMeta/test-fixtures/v0alpha1Response';
import { signInViewer } from '../pluginSettings/test-fixtures/apiDiscovery';

import { callDataSourcePluginProxy } from './callDataSourcePluginProxy';

jest.mock('../pluginMeta/plugins', () => ({
  getPluginMetaFromCache: jest.fn(),
}));

const getPluginMetaFromCacheMock = jest.mocked(getPluginMetaFromCache);

describe('datasource plugin proxy', () => {
  let backendSrv: BackendSrv;
  let logger: MonitoringLogger;
  const app = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'grafana-exploretraces-app')!;
  const ds = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'grafana-testdata-datasource')!;
  const panel = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'text')!;

  beforeAll(() => {
    initializeLoggersRegistry();
  });

  beforeEach(() => {
    jest.resetAllMocks();
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
    getPluginMetaFromCacheMock.mockResolvedValue(ds);
    backendSrv.get = jest.fn().mockResolvedValue({});
  });

  describe('when plugins.useMTPluginSettings flag is enabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPluginSettings]: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    describe('callDatasourcePluginProxy', () => {
      it('should call new apis with default arguments to call plugin proxy', async () => {
        const response = await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
        });

        expect(response).toStrictEqual({});
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/datasources/proxy/uid/tempo-dev/some/route',
          undefined,
          undefined,
          {
            showErrorAlert: false,
            validatePath: true,
          }
        );
      });

      it('should use supplied showErrorAlert argument to call plugin proxy', async () => {
        await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
          showErrorAlert: true,
        });

        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/datasources/proxy/uid/tempo-dev/some/route',
          undefined,
          undefined,
          {
            showErrorAlert: true,
            validatePath: true,
          }
        );
      });

      it('should reject a bad request without a result', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { message: 'Bad request' },
        });

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          })
        ).rejects.toEqual({
          status: 400,
          data: { message: 'Bad request' },
        });
      });

      it('should return undefined for app source plugins', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(app);

        const response = await callDataSourcePluginProxy({
          pluginId: 'grafana-exploretraces-app',
          uid: 'tempo-dev',
          routePath: 'some/route',
        });

        expect(response).toBeUndefined();
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should return undefined for panel plugins', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(panel);

        const response = await callDataSourcePluginProxy({
          pluginId: 'text',
          uid: 'tempo-dev',
          routePath: 'some/route',
        });

        expect(response).toBeUndefined();
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should fallback to legacy api when meta is null', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(null);

        const response = await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
        });

        expect(response).toStrictEqual({});
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/datasources/proxy/uid/tempo-dev/some/route',
          undefined,
          undefined,
          { showErrorAlert: false, validatePath: true }
        );
        expect(logger.logDebug).toHaveBeenCalledTimes(1);
        expect(logger.logDebug).toHaveBeenCalledWith(
          'PluginProxy: falling back to calling legacy datasource plugin proxy',
          {
            pluginId: 'grafana-testdata-datasource',
          }
        );
      });

      it('should reject thrown error if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          })
        ).rejects.toEqual({
          status: 404,
          message: 'Not found',
        });
        expect(logger.logError).toHaveBeenCalledWith(
          new TracedError('PluginProxy: calling legacy datasource plugin proxy failed', {
            status: 404,
            message: 'Not found',
          }),
          { uid: 'tempo-dev', routePath: 'some/route' }
        );
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          })
        ).rejects.toEqual({
          status: 403,
          message: 'Forbidden',
          isHandled: true,
        });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          })
        ).rejects.toEqual({
          status: 401,
          message: 'Unauthorized',
          isHandled: true,
        });
      });

      it('should reject invalid API versions without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
            apiVersion: 'v1/namespaces/other/app/instance/proxy/secret?x=',
          })
        ).rejects.toThrow('Invalid API version \"v1/namespaces/other/app/instance/proxy/secret?x=\"');

        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should call the legacy proxy without a discovery request', async () => {
        const session = signInViewer();

        try {
          await callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          });
        } finally {
          session.restore();
        }

        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/datasources/proxy/uid/tempo-dev/some/route',
          undefined,
          undefined,
          {
            showErrorAlert: false,
            validatePath: true,
          }
        );
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text/secret?x=', uid: 'tempo-dev', routePath: 'some/route' })
        ).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(backendSrv.get).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });

      it('should reject invalid UIDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text', uid: 'tempo-dev/secret?x=', routePath: 'some/route' })
        ).rejects.toThrow('Invalid UID \"tempo-dev/secret?x=\"');

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

    describe('callDatasourcePluginProxy', () => {
      it('should call legacy apis with default arguments to call plugin proxy', async () => {
        const response = await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
        });

        expect(response).toStrictEqual({});
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/datasources/proxy/uid/tempo-dev/some/route',
          undefined,
          undefined,
          {
            showErrorAlert: false,
            validatePath: true,
          }
        );
      });

      it('should use supplied showErrorAlert argument to call plugin proxy', async () => {
        await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
          showErrorAlert: true,
        });

        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/datasources/proxy/uid/tempo-dev/some/route',
          undefined,
          undefined,
          {
            showErrorAlert: true,
            validatePath: true,
          }
        );
      });

      it('should reject thrown error if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          })
        ).rejects.toEqual({
          status: 404,
          message: 'Not found',
        });
        expect(logger.logError).toHaveBeenCalledWith(
          new TracedError('PluginProxy: calling legacy datasource plugin proxy failed', {
            status: 404,
            message: 'Not found',
          }),
          { uid: 'tempo-dev', routePath: 'some/route' }
        );
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          })
        ).rejects.toEqual({
          status: 403,
          message: 'Forbidden',
          isHandled: true,
        });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'some/route',
          })
        ).rejects.toEqual({
          status: 401,
          message: 'Unauthorized',
          isHandled: true,
        });
      });

      it('should not care about invalid API versions', async () => {
        await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
          apiVersion: 'v1/namespaces/other/app/instance/proxy/secret?x=',
        });

        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/datasources/proxy/uid/tempo-dev/some/route',
          undefined,
          undefined,
          {
            showErrorAlert: false,
            validatePath: true,
          }
        );
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text/secret?x=', uid: 'tempo-dev', routePath: 'some/route' })
        ).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(backendSrv.get).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });

      it('should reject invalid UIDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text', uid: 'tempo-dev/secret?x=', routePath: 'some/route' })
        ).rejects.toThrow('Invalid UID \"tempo-dev/secret?x=\"');

        expect(backendSrv.get).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });
    });
  });
});
