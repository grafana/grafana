import { FieldConfigSource, PanelPlugin, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getPresets } from './getPresets';

jest.mock('app/features/plugins/importPanelPlugin');

describe('getPresets', () => {
  const mockGetPresets = jest.fn();
  const mockPlugin = { getPresets: mockGetPresets } as unknown as PanelPlugin;

  beforeEach(() => {
    jest.mocked(importPanelPlugin).mockResolvedValue(mockPlugin);
    mockGetPresets.mockReset();
  });

  it('should call importPanelPlugin with the given pluginId', async () => {
    mockGetPresets.mockReturnValue([]);

    await getPresets('timeseries');

    expect(importPanelPlugin).toHaveBeenCalledWith('timeseries');
  });

  it('should return presets returned by the plugin', async () => {
    const presets: PanelPluginVisualizationSuggestion[] = [
      { pluginId: 'timeseries', name: 'Default', hash: 'hash-1', options: {} },
      { pluginId: 'timeseries', name: 'Lines', hash: 'hash-2', options: {} },
    ];
    mockGetPresets.mockReturnValue(presets);

    const result = await getPresets('timeseries');

    expect(result).toEqual(presets);
  });

  it('should pass fieldConfig to plugin.getPresets()', async () => {
    const fieldConfig: FieldConfigSource = { defaults: { unit: 'bytes' }, overrides: [] };
    mockGetPresets.mockReturnValue([]);

    await getPresets('timeseries', fieldConfig);

    expect(mockGetPresets).toHaveBeenCalledWith({ fieldConfig });
  });

  it('should return an empty array when plugin.getPresets() returns undefined', async () => {
    mockGetPresets.mockReturnValue(undefined);

    const result = await getPresets('timeseries');

    expect(result).toEqual([]);
  });
});
