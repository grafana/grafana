import { type PluginMeta } from '@grafana/data';
import {
  getPluginSettings as stableGetPluginSettings,
  updateAppPluginSettings as stableUpdateAppPluginSettings,
  getAppPluginHealth as stableGetAppPluginHealth,
  type HealthCheckResult,
  HealthStatus,
  callAppPluginProxy as stableCallAppPluginProxy,
} from '@grafana/runtime';

import { callAppPluginProxy, getAppPluginHealth, getPluginSettings, updateAppPluginSettings } from './apps';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginSettings: jest.fn(),
  updateAppPluginSettings: jest.fn(),
  getAppPluginHealth: jest.fn(),
  callAppPluginProxy: jest.fn(),
}));

const mockStableGetPluginSettings = jest.mocked(stableGetPluginSettings);
const mockStableUpdateAppPluginSettings = jest.mocked(stableUpdateAppPluginSettings);
const mockStableGetAppPluginHealth = jest.mocked(stableGetAppPluginHealth);
const mockStableCallAppPluginProxy = jest.mocked(stableCallAppPluginProxy);
const mockData: Partial<PluginMeta> = { enabled: true, pinned: true };
const result: HealthCheckResult = { status: HealthStatus.OK, message: 'All good', details: { set: true } };

describe('getPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetPluginSettings.mockResolvedValue(mockData as PluginMeta);
  });

  it('should call the stable export', async () => {
    const result = await getPluginSettings('grafana-exploretraces-app', true);

    expect(mockStableGetPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', true);
    expect(result).toStrictEqual(mockData);
  });

  it('should default showErrorAlert to false', async () => {
    await getPluginSettings('grafana-exploretraces-app');

    expect(mockStableGetPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', false);
  });
});

describe('updateAppPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableUpdateAppPluginSettings.mockResolvedValue(mockData as PluginMeta);
  });

  it('should call the stable export', async () => {
    const result = await updateAppPluginSettings('grafana-exploretraces-app', mockData);

    expect(mockStableUpdateAppPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', { ...mockData });
    expect(result).toStrictEqual(mockData);
  });
});

describe('getAppPluginHealth', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetAppPluginHealth.mockResolvedValue(result);
  });

  it('should call the stable export', async () => {
    const result = await getAppPluginHealth('grafana-exploretraces-app', true);

    expect(mockStableGetAppPluginHealth).toHaveBeenCalledWith('grafana-exploretraces-app', true, undefined);
    expect(result).toStrictEqual({ details: { set: true }, message: 'All good', status: 'OK' });
  });

  it('should use supplied apiVersion argument to fetch health result', async () => {
    await getAppPluginHealth('grafana-exploretraces-app', true, 'v1alpha1');

    expect(mockStableGetAppPluginHealth).toHaveBeenCalledWith('grafana-exploretraces-app', true, 'v1alpha1');
  });
});

describe('callAppPluginProxy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableCallAppPluginProxy.mockResolvedValue({});
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await callAppPluginProxy({ pluginId: 'grafana-exploretraces-app', routePath: 'some/route' });

    expect(mockStableCallAppPluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-exploretraces-app',
      routePath: 'some/route',
      showErrorAlert: undefined,
      apiVersion: undefined,
    });
    expect(result).toStrictEqual({});
  });

  it('should use supplied showErrorAlert argument to call plugin proxy', async () => {
    await callAppPluginProxy({
      pluginId: 'grafana-exploretraces-app',
      routePath: 'some/route',
      showErrorAlert: true,
    });

    expect(mockStableCallAppPluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-exploretraces-app',
      routePath: 'some/route',
      showErrorAlert: true,
    });
  });

  it('should use supplied apiVersion argument to call plugin proxy', async () => {
    await callAppPluginProxy({
      pluginId: 'grafana-exploretraces-app',
      routePath: 'some/route',
      apiVersion: 'v1alpha1',
    });

    expect(mockStableCallAppPluginProxy).toHaveBeenCalledWith({
      pluginId: 'grafana-exploretraces-app',
      routePath: 'some/route',
      showErrorAlert: undefined,
      apiVersion: 'v1alpha1',
    });
  });
});
