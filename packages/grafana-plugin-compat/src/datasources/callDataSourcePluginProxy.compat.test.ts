import { of, throwError } from 'rxjs';

import { setBackendSrv, type BackendSrv, type FetchResponse } from '@grafana/runtime';

import { getMockedBackendSrv } from '../utils/mocks';

import { callDataSourcePluginProxy } from './callDataSourcePluginProxy';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  callDataSourcePluginProxy: undefined,
}));

const mockBackendSrv = getMockedBackendSrv();
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

describe('callDataSourcePluginProxy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    mockBackendSrv.fetch.mockReturnValue(of(proxyResponse));
  });

  it('should fetch GET and return the full response when the stable export is absent', async () => {
    const response = await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
    });

    expect(response?.data).toStrictEqual({});
    expect(response?.status).toBe(200);

    expect(mockBackendSrv.fetch).toHaveBeenCalledTimes(1);
    expect(mockBackendSrv.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/datasources/proxy/uid/tempo-dev/some/route',
        method: 'GET',
        showErrorAlert: false,
        validatePath: true,
      })
    );
  });

  it('should pass through showErrorAlert when callDataSourcePluginProxy does not exist', async () => {
    await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      showErrorAlert: true,
    });

    expect(mockBackendSrv.fetch).toHaveBeenCalledTimes(1);
    expect(mockBackendSrv.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/datasources/proxy/uid/tempo-dev/some/route',
        method: 'GET',
        showErrorAlert: true,
        validatePath: true,
      })
    );
  });

  it('should reject unauthorized requests and mark them handled', async () => {
    mockBackendSrv.fetch.mockReturnValue(throwError(() => ({ status: 401, data: { message: 'Unauthorized' } })));

    await expect(
      callDataSourcePluginProxy({ pluginId: 'grafana-testdata-datasource', uid: 'tempo-dev', routePath: 'some/route' })
    ).rejects.toEqual({
      status: 401,
      data: { message: 'Unauthorized' },
      isHandled: true,
    });
  });

  it('should reject forbidden requests and mark them handled', async () => {
    mockBackendSrv.fetch.mockReturnValue(throwError(() => ({ status: 403, data: { message: 'Forbidden' } })));

    await expect(
      callDataSourcePluginProxy({ pluginId: 'grafana-testdata-datasource', uid: 'tempo-dev', routePath: 'some/route' })
    ).rejects.toEqual({
      status: 403,
      data: { message: 'Forbidden' },
      isHandled: true,
    });
  });

  it('should reject thrown error if error status is not 403 or 401', async () => {
    const error = { status: 404, message: 'Not found' };
    mockBackendSrv.fetch.mockReturnValue(throwError(() => error));

    await expect(
      callDataSourcePluginProxy({ pluginId: 'grafana-testdata-datasource', uid: 'tempo-dev', routePath: 'some/route' })
    ).rejects.toEqual({
      status: 404,
      message: 'Not found',
    });
  });

  it('should reject when getBackendSrv is not setup', async () => {
    setBackendSrv(undefined as unknown as BackendSrv);

    await expect(
      callDataSourcePluginProxy({ pluginId: 'grafana-testdata-datasource', uid: 'tempo-dev', routePath: 'some/route' })
    ).rejects.toThrow();
  });
});
