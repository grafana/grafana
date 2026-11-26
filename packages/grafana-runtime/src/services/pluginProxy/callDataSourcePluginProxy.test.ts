import { of, throwError } from 'rxjs';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { FlagKeys } from '../../internal';
import { TracedError } from '../../utils/TracedError';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, type FetchResponse, setBackendSrv } from '../backendSrv';
import { initializeLoggersRegistry, setLogger } from '../logging/registry';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { v0alpha1Response } from '../pluginMeta/test-fixtures/v0alpha1Response';

import { callDataSourcePluginProxy } from './callDataSourcePluginProxy';

jest.mock('../pluginMeta/plugins', () => ({
  getPluginMetaFromCache: jest.fn(),
}));

const getPluginMetaFromCacheMock = jest.mocked(getPluginMetaFromCache);

const proxyResponse: FetchResponse = {
  data: {},
  status: 200,
  statusText: 'OK',
  ok: true,
  headers: new Headers(),
  redirected: false,
  type: 'basic',
  url: '/api/datasources/proxy/uid/tempo-dev/some/route',
  config: { url: '/api/datasources/proxy/uid/tempo-dev/some/route' },
};

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
    jest.mocked(backendSrv.fetch).mockReturnValue(of(proxyResponse));
  });

  describe('when plugins.useMTPluginSettings flag is enabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPluginSettings]: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    describe('callDatasourcePluginProxy', () => {
      it('should keep the existing URL and return the full response for GET', async () => {
        const response = await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route?limit=1',
        });

        expect(response?.data).toStrictEqual({});
        expect(response?.status).toBe(200);
        expect(backendSrv.fetch).toHaveBeenCalledTimes(1);
        expect(backendSrv.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/datasources/proxy/uid/tempo-dev/some/route?limit=1',
            method: 'GET',
            showErrorAlert: false,
            validatePath: true,
          })
        );
      });

      it('should use supplied showErrorAlert argument to call plugin proxy', async () => {
        await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
          showErrorAlert: true,
        });

        expect(backendSrv.fetch).toHaveBeenCalledTimes(1);
        expect(backendSrv.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/datasources/proxy/uid/tempo-dev/some/route',
            method: 'GET',
            showErrorAlert: true,
            validatePath: true,
          })
        );
      });

      it('should forward POST options and return the full response', async () => {
        const abortSignal = new AbortController().signal;
        const profile = new Blob(['profile']);
        jest.mocked(backendSrv.fetch).mockReturnValue(of({ ...proxyResponse, data: profile }));

        const response = await callDataSourcePluginProxy<Blob>({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'render?format=pprof',
          request: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: { query: 'cpu' },
            abortSignal,
            credentials: 'same-origin',
            responseType: 'blob',
          },
        });

        expect(response?.status).toBe(200);
        expect(response?.data === profile).toBe(true);
        expect(backendSrv.fetch).toHaveBeenCalledTimes(1);
        expect(backendSrv.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/datasources/proxy/uid/tempo-dev/render?format=pprof',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: { query: 'cpu' },
            credentials: 'same-origin',
            responseType: 'blob',
            showErrorAlert: false,
            validatePath: true,
          })
        );
        expect(jest.mocked(backendSrv.fetch).mock.calls[0][0].abortSignal === abortSignal).toBe(true);
      });

      it('should preserve the POST error body and make only one request', async () => {
        jest
          .mocked(backendSrv.fetch)
          .mockReturnValue(throwError(() => ({ status: 404, data: { message: 'Profile not found' } })));

        await expect(
          callDataSourcePluginProxy({
            pluginId: 'grafana-testdata-datasource',
            uid: 'tempo-dev',
            routePath: 'render',
            request: { method: 'POST', data: { query: 'cpu' } },
          })
        ).rejects.toEqual({
          status: 404,
          data: { message: 'Profile not found' },
        });
        expect(backendSrv.fetch).toHaveBeenCalledTimes(1);
      });

      it('should reject a bad request without a result', async () => {
        jest
          .mocked(backendSrv.fetch)
          .mockReturnValue(throwError(() => ({ status: 400, data: { message: 'Bad request' } })));

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
        expect(backendSrv.fetch).not.toHaveBeenCalled();
      });

      it('should return undefined for panel plugins', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(panel);

        const response = await callDataSourcePluginProxy({
          pluginId: 'text',
          uid: 'tempo-dev',
          routePath: 'some/route',
        });

        expect(response).toBeUndefined();
        expect(backendSrv.fetch).not.toHaveBeenCalled();
      });

      it('should fallback to legacy api when meta is null', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(null);

        const response = await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
        });

        expect(response?.data).toStrictEqual({});
        expect(response?.status).toBe(200);
        expect(backendSrv.fetch).toHaveBeenCalledTimes(1);
        expect(backendSrv.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/datasources/proxy/uid/tempo-dev/some/route',
            method: 'GET',
            showErrorAlert: false,
            validatePath: true,
          })
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
        jest.mocked(backendSrv.fetch).mockReturnValue(throwError(() => error));

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
        jest.mocked(backendSrv.fetch).mockReturnValue(throwError(() => error));

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
        jest.mocked(backendSrv.fetch).mockReturnValue(throwError(() => error));

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

        expect(backendSrv.fetch).not.toHaveBeenCalled();
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text/secret?x=', uid: 'tempo-dev', routePath: 'some/route' })
        ).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(backendSrv.fetch).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });

      it('should reject invalid UIDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text', uid: 'tempo-dev/secret?x=', routePath: 'some/route' })
        ).rejects.toThrow('Invalid UID \"tempo-dev/secret?x=\"');

        expect(backendSrv.fetch).not.toHaveBeenCalled();
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
      it('should keep the existing URL and return the full response for GET', async () => {
        const response = await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route?limit=1',
        });

        expect(response?.data).toStrictEqual({});
        expect(response?.status).toBe(200);
        expect(backendSrv.fetch).toHaveBeenCalledTimes(1);
        expect(backendSrv.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/datasources/proxy/uid/tempo-dev/some/route?limit=1',
            method: 'GET',
            showErrorAlert: false,
            validatePath: true,
          })
        );
      });

      it('should use supplied showErrorAlert argument to call plugin proxy', async () => {
        await callDataSourcePluginProxy({
          pluginId: 'grafana-testdata-datasource',
          uid: 'tempo-dev',
          routePath: 'some/route',
          showErrorAlert: true,
        });

        expect(backendSrv.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/datasources/proxy/uid/tempo-dev/some/route',
            method: 'GET',
            showErrorAlert: true,
            validatePath: true,
          })
        );
      });

      it('should reject thrown error if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        jest.mocked(backendSrv.fetch).mockReturnValue(throwError(() => error));

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
        jest.mocked(backendSrv.fetch).mockReturnValue(throwError(() => error));

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
        jest.mocked(backendSrv.fetch).mockReturnValue(throwError(() => error));

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

        expect(backendSrv.fetch).toHaveBeenCalledTimes(1);
        expect(backendSrv.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/datasources/proxy/uid/tempo-dev/some/route',
            method: 'GET',
            showErrorAlert: false,
            validatePath: true,
          })
        );
      });

      it('should reject invalid plugin IDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text/secret?x=', uid: 'tempo-dev', routePath: 'some/route' })
        ).rejects.toThrow('Invalid plugin ID \"text/secret?x=\"');

        expect(backendSrv.fetch).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });

      it('should reject invalid UIDs without making a request', async () => {
        await expect(
          callDataSourcePluginProxy({ pluginId: 'text', uid: 'tempo-dev/secret?x=', routePath: 'some/route' })
        ).rejects.toThrow('Invalid UID \"tempo-dev/secret?x=\"');

        expect(backendSrv.fetch).not.toHaveBeenCalled();
        expect(getPluginMetaFromCacheMock).not.toHaveBeenCalled();
      });
    });
  });
});
