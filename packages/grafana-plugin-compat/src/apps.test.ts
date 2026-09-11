import { type PluginMeta } from '@grafana/data';
import {
  getPluginSettings as runtimeGetPluginSettings,
  updateAppPluginSettings as runtimeUpdateAppPluginSettings,
} from '@grafana/runtime/unstable';

import { getPluginSettings, updatePluginSettings } from './apps';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getPluginSettings: jest.fn(),
  updateAppPluginSettings: jest.fn(),
}));

const mockRuntimeGetAppPluginSettings = jest.mocked(runtimeGetPluginSettings);
const mockRuntimeUpdateAppPluginSettings = jest.mocked(runtimeUpdateAppPluginSettings);
const mockData: Partial<PluginMeta> = { enabled: true, pinned: true };

describe('getPluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuntimeGetAppPluginSettings.mockResolvedValue(mockData as PluginMeta);
  });

  it('should call correct function when getPluginSettings exists', async () => {
    await getPluginSettings('grafana-exploretraces-app', true);

    expect(mockRuntimeGetAppPluginSettings).toHaveBeenCalled();
    expect(mockRuntimeGetAppPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', true);
  });

  it('should default to showErrorAlert === false when getPluginSettings exists', async () => {
    await getPluginSettings('grafana-exploretraces-app');

    expect(mockRuntimeGetAppPluginSettings).toHaveBeenCalled();
    expect(mockRuntimeGetAppPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', false);
  });
});

describe('updatePluginSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuntimeUpdateAppPluginSettings.mockResolvedValue(mockData as PluginMeta);
  });

  it('should call correct function when updateAppPluginSettings exists', async () => {
    await updatePluginSettings('grafana-exploretraces-app', mockData);

    expect(mockRuntimeUpdateAppPluginSettings).toHaveBeenCalled();
    expect(mockRuntimeUpdateAppPluginSettings).toHaveBeenCalledWith('grafana-exploretraces-app', { ...mockData });
  });

  it('should return correct response when updateAppPluginSettings exists', async () => {
    const result = await updatePluginSettings('grafana-exploretraces-app', mockData);

    expect(result).toStrictEqual(mockData);
  });
});
