import { type PluginMeta } from '@grafana/data';
import {
  getPluginSettings as stableGetPluginSettings,
  updateAppPluginSettings as stableUpdateAppPluginSettings,
  getAppPluginHealth as stableGetAppPluginHealth,
  type HealthCheckResult,
  HealthStatus,
} from '@grafana/runtime';
import {
  getPluginSettings as unstableGetPluginSettings,
  updateAppPluginSettings as unstableUpdateAppPluginSettings,
} from '@grafana/runtime/unstable';

import { getAppPluginHealth, getPluginSettings, updateAppPluginSettings } from './apps';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginSettings: jest.fn(),
  updateAppPluginSettings: jest.fn(),
  getAppPluginHealth: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getPluginSettings: jest.fn(),
  updateAppPluginSettings: jest.fn(),
}));

const mockStableGetPluginSettings = jest.mocked(stableGetPluginSettings);
const mockUnstableGetPluginSettings = jest.mocked(unstableGetPluginSettings);
const mockStableUpdateAppPluginSettings = jest.mocked(stableUpdateAppPluginSettings);
const mockUnstableUpdateAppPluginSettings = jest.mocked(unstableUpdateAppPluginSettings);
const mockStableGetAppPluginHealth = jest.mocked(stableGetAppPluginHealth);
const mockData: Partial<PluginMeta> = { enabled: true, pinned: true };
const result: HealthCheckResult = { status: HealthStatus.OK, message: 'All good', details: { set: true } };

describe('getPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetPluginSettings.mockResolvedValue(mockData as PluginMeta);
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await getPluginSettings('grafana-exploretraces-app', true);

    expect(mockStableGetPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', true);
    expect(mockUnstableGetPluginSettings).not.toHaveBeenCalled();
    expect(result).toStrictEqual(mockData);
  });
});

describe('updateAppPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableUpdateAppPluginSettings.mockResolvedValue(mockData as PluginMeta);
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await updateAppPluginSettings('grafana-exploretraces-app', mockData);

    expect(mockStableUpdateAppPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', { ...mockData });
    expect(mockUnstableUpdateAppPluginSettings).not.toHaveBeenCalled();
    expect(result).toStrictEqual(mockData);
  });
});

describe('getAppPluginHealth', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetAppPluginHealth.mockResolvedValue(result);
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await getAppPluginHealth('grafana-exploretraces-app', true);

    expect(mockStableGetAppPluginHealth).toHaveBeenCalledWith('grafana-exploretraces-app', true, undefined);
    expect(result).toStrictEqual({ details: { set: true }, message: 'All good', status: 'OK' });
  });

  it('should use supplied apiVersion argument to fetch health result', async () => {
    await getAppPluginHealth('grafana-exploretraces-app', true, 'v1alpha1');

    expect(mockStableGetAppPluginHealth).toHaveBeenCalledWith('grafana-exploretraces-app', true, 'v1alpha1');
  });
});
