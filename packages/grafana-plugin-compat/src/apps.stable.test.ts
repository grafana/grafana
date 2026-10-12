import { type PluginMeta } from '@grafana/data';
import {
  getPluginSettings as stableGetPluginSettings,
  updateAppPluginSettings as stableUpdateAppPluginSettings,
} from '@grafana/runtime';
import {
  getPluginSettings as unstableGetPluginSettings,
  updateAppPluginSettings as unstableUpdateAppPluginSettings,
} from '@grafana/runtime/unstable';

import { getPluginSettings, updateAppPluginSettings } from './apps';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginSettings: jest.fn(),
  updateAppPluginSettings: jest.fn(),
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
const mockData: Partial<PluginMeta> = { enabled: true, pinned: true };

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
