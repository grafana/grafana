import { callDataSourcePluginProxy as stableCallDataSourcePluginProxy, type FetchResponse } from '@grafana/runtime';

import { callDataSourcePluginProxy } from './callDataSourcePluginProxy';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  callDataSourcePluginProxy: jest.fn(),
}));

const mockStableCallDataSourcePluginProxy = jest.mocked(stableCallDataSourcePluginProxy);

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
    mockStableCallDataSourcePluginProxy.mockResolvedValue(proxyResponse);
  });

  it('should prefer the stable export', async () => {
    const result = await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
    });

    expect(result?.data).toStrictEqual({});
    expect(result?.status).toBe(200);
    expect(mockStableCallDataSourcePluginProxy).toHaveBeenCalledTimes(1);
    expect(mockStableCallDataSourcePluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      showErrorAlert: undefined,
      apiVersion: undefined,
    });
  });

  it('should forward request options to the stable export', async () => {
    await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'render',
      request: { method: 'POST', data: { query: 'cpu' }, responseType: 'blob' },
    });

    expect(mockStableCallDataSourcePluginProxy).toHaveBeenCalledTimes(1);
    expect(mockStableCallDataSourcePluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'render',
      request: { method: 'POST', data: { query: 'cpu' }, responseType: 'blob' },
    });
  });

  it('should use supplied showErrorAlert argument to call datasource plugin proxy', async () => {
    await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      showErrorAlert: true,
    });

    expect(mockStableCallDataSourcePluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      showErrorAlert: true,
    });
  });

  it('should use supplied apiVersion argument to call datasource plugin proxy', async () => {
    await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      apiVersion: 'v1alpha1',
    });

    expect(mockStableCallDataSourcePluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      showErrorAlert: undefined,
      apiVersion: 'v1alpha1',
    });
  });
});
