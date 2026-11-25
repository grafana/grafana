import { setBackendSrv, type BackendSrv } from '@grafana/runtime';

import { getMockedBackendSrv } from '../utils/mocks';

import { callDataSourcePluginProxy } from './callDataSourcePluginProxy';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  callDataSourcePluginProxy: undefined,
}));

const mockBackendSrv = getMockedBackendSrv();

describe('callDataSourcePluginProxy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setBackendSrv(mockBackendSrv);
    mockBackendSrv.get = jest.fn().mockResolvedValue({});
  });

  it('should call correct function when callDataSourcePluginProxy does not exist', async () => {
    await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
    });

    expect(mockBackendSrv.get).toHaveBeenCalled();
    expect(mockBackendSrv.get).toHaveBeenCalledWith(
      `/api/datasources/proxy/uid/tempo-dev/some/route`,
      undefined,
      undefined,
      {
        showErrorAlert: false,
        validatePath: true,
      }
    );
  });

  it('should pass through showErrorAlert when callDataSourcePluginProxy does not exist', async () => {
    await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      showErrorAlert: true,
    });

    expect(mockBackendSrv.get).toHaveBeenCalled();
    expect(mockBackendSrv.get).toHaveBeenCalledWith(
      `/api/datasources/proxy/uid/tempo-dev/some/route`,
      undefined,
      undefined,
      {
        showErrorAlert: true,
        validatePath: true,
      }
    );
  });

  it('should reject unauthorized requests and mark them handled', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 401,
      data: { message: 'Unauthorized' },
    });

    await expect(
      callDataSourcePluginProxy({ pluginId: 'grafana-testdata-datasource', uid: 'tempo-dev', routePath: 'some/route' })
    ).rejects.toEqual({
      status: 401,
      data: { message: 'Unauthorized' },
      isHandled: true,
    });
  });

  it('should reject forbidden requests and mark them handled', async () => {
    mockBackendSrv.get = jest.fn().mockRejectedValue({
      status: 403,
      data: { message: 'Forbidden' },
    });

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
    mockBackendSrv.get = jest.fn().mockRejectedValue(error);

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
