import { callDataSourcePluginProxy as stableCallDataSourcePluginProxy } from '@grafana/runtime';

import { callDataSourcePluginProxy } from './callDataSourcePluginProxy';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  callDataSourcePluginProxy: jest.fn(),
}));

const mockStableCallDataSourcePluginProxy = jest.mocked(stableCallDataSourcePluginProxy);

describe('callDataSourcePluginProxy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableCallDataSourcePluginProxy.mockResolvedValue({});
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await callDataSourcePluginProxy({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
    });

    expect(mockStableCallDataSourcePluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-testdata-datasource',
      uid: 'tempo-dev',
      routePath: 'some/route',
      showErrorAlert: undefined,
      apiVersion: undefined,
    });
    expect(result).toStrictEqual({});
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
