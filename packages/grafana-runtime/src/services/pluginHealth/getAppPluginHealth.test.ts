import { setTestFlags } from '@grafana/test-utils/unstable';

import { FlagKeys } from '../../internal';
import { type HealthCheckResult, HealthStatus } from '../../utils/DataSourceWithBackend';
import { TracedError } from '../../utils/TracedError';
import { type MonitoringLogger } from '../../utils/logging';
import { type BackendSrv, setBackendSrv } from '../backendSrv';
import { initializeLoggersRegistry, setLogger } from '../logging/registry';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { v0alpha1Response } from '../pluginMeta/test-fixtures/v0alpha1Response';

import { getAppPluginHealth } from './getAppPluginHealth';

jest.mock('../pluginMeta/plugins', () => ({
  getPluginMetaFromCache: jest.fn(),
}));

const getPluginMetaFromCacheMock = jest.mocked(getPluginMetaFromCache);

describe('health', () => {
  let backendSrv: BackendSrv;
  let logger: MonitoringLogger;
  const result: HealthCheckResult = { status: HealthStatus.OK, message: 'All good', details: { set: true } };
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
    getPluginMetaFromCacheMock.mockResolvedValue(app);
    backendSrv.get = jest.fn().mockResolvedValue(result);
  });

  describe('when plugins.useMTPluginSettings flag is enabled', () => {
    beforeAll(() => {
      setTestFlags({ [FlagKeys.PluginsUseMTPluginSettings]: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    describe('getAppPluginHealth', () => {
      it('should call new apis with default arguments to fetch health result', async () => {
        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toMatchObject({ status: HealthStatus.OK, message: 'All good', details: { set: true } });
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/grafana-exploretraces-app/v0alpha1/namespaces/default/app/instance/health',
          undefined,
          undefined,
          {
            showErrorAlert: false,
            validatePath: true,
          }
        );
      });

      it('should use supplied showErrorAlert argument to fetch health result', async () => {
        await getAppPluginHealth('grafana-exploretraces-app', true);

        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/grafana-exploretraces-app/v0alpha1/namespaces/default/app/instance/health',
          undefined,
          undefined,
          {
            showErrorAlert: true,
            validatePath: true,
          }
        );
      });

      it('should use supplied apiVersion argument to fetch health result', async () => {
        await getAppPluginHealth('grafana-exploretraces-app', undefined, 'v1alpha1');

        expect(backendSrv.get).toHaveBeenCalledWith(
          '/apis/grafana-exploretraces-app/v1alpha1/namespaces/default/app/instance/health',
          undefined,
          undefined,
          {
            showErrorAlert: false,
            validatePath: true,
          }
        );
      });

      it('should return an unhealthy health result with details', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { status: 'ERROR', message: 'Invalid credentials', details: { reason: 'credentials' } },
        });

        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toEqual({
          status: 'ERROR',
          message: 'Invalid credentials',
          details: { reason: 'credentials' },
        });
        expect(logger.logError).not.toHaveBeenCalled();
      });

      it('should return an unknown health result', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { status: 'UNKNOWN', message: 'Health unknown' },
        });

        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toEqual({ status: 'UNKNOWN', message: 'Health unknown' });
      });

      it('should reject a bad request without a health result', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { message: 'Bad request' },
        });

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 400,
          data: { message: 'Bad request' },
        });
      });

      it('should reject a server failure with a health-shaped payload', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 500,
          data: { status: 'ERROR', message: 'Backend failed' },
        });

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 500,
          data: { status: 'ERROR', message: 'Backend failed' },
        });
      });

      it('should use an empty message when an unhealthy k8s response omits it', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { status: 'ERROR', details: { reason: 'credentials' } },
        });

        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toEqual({ status: 'ERROR', message: '', details: { reason: 'credentials' } });
        expect(logger.logError).not.toHaveBeenCalled();
      });

      it('should use an empty message when a healthy k8s response omits it', async () => {
        backendSrv.get = jest.fn().mockResolvedValue({ status: 'OK' });

        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toEqual({ status: 'OK', message: '' });
      });

      it('should return undefined for data source plugins', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(ds);

        const response = await getAppPluginHealth('grafana-testdata-datasource');

        expect(response).toBeUndefined();
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should return undefined for panel plugins', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(panel);

        const response = await getAppPluginHealth('text');

        expect(response).toBeUndefined();
        expect(backendSrv.get).not.toHaveBeenCalled();
      });

      it('should fallback to legacy api when meta is null', async () => {
        getPluginMetaFromCacheMock.mockResolvedValue(null);

        const response = await getAppPluginHealth('grafana-exploretraces-app', true);

        expect(response).toMatchObject({ status: HealthStatus.OK, message: 'All good', details: { set: true } });
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/plugins/grafana-exploretraces-app/health',
          undefined,
          undefined,
          { showErrorAlert: true, validatePath: true }
        );
        expect(logger.logDebug).toHaveBeenCalledTimes(1);
        expect(logger.logDebug).toHaveBeenCalledWith('PluginHealth: falling back to getting legacy plugin health', {
          pluginId: 'grafana-exploretraces-app',
        });
      });

      it('should reject thrown error if error status is not 403 or 401', async () => {
        const error = { status: 404, message: 'Not found' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 404,
          message: 'Not found',
        });
        expect(logger.logError).toHaveBeenCalledWith(
          new TracedError('PluginHealth: getting plugin health failed', { status: 404, message: 'Not found' }),
          { pluginId: 'grafana-exploretraces-app' }
        );
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 403,
          message: 'Forbidden',
          isHandled: true,
        });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 401,
          message: 'Unauthorized',
          isHandled: true,
        });
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

    describe('getAppPluginHealth', () => {
      it('should return an unhealthy health result with details', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { status: 'ERROR', message: 'Invalid credentials', details: { reason: 'credentials' } },
        });

        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toEqual({
          status: 'ERROR',
          message: 'Invalid credentials',
          details: { reason: 'credentials' },
        });
        expect(logger.logError).not.toHaveBeenCalled();
      });

      it('should return an unknown health result', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { status: 'UNKNOWN', message: 'Health unknown' },
        });

        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toEqual({
          status: 'UNKNOWN',
          message: 'Health unknown',
        });
      });

      it('should reject a bad request without a health result', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 400,
          data: { message: 'Bad request' },
        });

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 400,
          data: { message: 'Bad request' },
        });
      });

      it('should reject a server failure with a health-shaped payload', async () => {
        backendSrv.get = jest.fn().mockRejectedValue({
          status: 500,
          data: { status: 'ERROR', message: 'Backend failed' },
        });

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 500,
          data: { status: 'ERROR', message: 'Backend failed' },
        });
      });

      it('should call legacy apis with default arguments to fetch legacy health result', async () => {
        const response = await getAppPluginHealth('grafana-exploretraces-app');

        expect(response).toMatchObject({ status: HealthStatus.OK, message: 'All good', details: { set: true } });
        expect(backendSrv.get).toHaveBeenCalledTimes(1);
        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/plugins/grafana-exploretraces-app/health',
          undefined,
          undefined,
          {
            showErrorAlert: false,
            validatePath: true,
          }
        );
      });

      it('should use supplied showErrorAlert argument to fetch legacy health result', async () => {
        await getAppPluginHealth('grafana-exploretraces-app', true);

        expect(backendSrv.get).toHaveBeenCalledWith(
          '/api/plugins/grafana-exploretraces-app/health',
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

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 404,
          message: 'Not found',
        });
        expect(logger.logError).toHaveBeenCalledWith(
          new TracedError('PluginHealth: getting legacy plugin health failed', {
            status: 404,
            message: 'Not found',
          }),
          { pluginId: 'grafana-exploretraces-app' }
        );
      });

      it('should reject thrown error if error status is 403', async () => {
        const error = { status: 403, message: 'Forbidden' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 403,
          message: 'Forbidden',
          isHandled: true,
        });
      });

      it('should reject thrown error if error status is 401', async () => {
        const error = { status: 401, message: 'Unauthorized' };
        backendSrv.get = jest.fn().mockRejectedValue(error);

        await expect(getAppPluginHealth('grafana-exploretraces-app')).rejects.toEqual({
          status: 401,
          message: 'Unauthorized',
          isHandled: true,
        });
      });
    });
  });
});
