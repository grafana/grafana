import { config } from '@grafana/runtime';

import { getPresetsForPanel } from './getPresets';

config.featureToggles.vizPresets = true;

describe('getPresetsForPanel', () => {
  it('should return empty presets when feature toggle is disabled', async () => {
    config.featureToggles.vizPresets = false;

    const result = await getPresetsForPanel('timeseries');

    expect(result).toEqual({ presets: [] });

    config.featureToggles.vizPresets = true;
  });

  it('should return empty presets when plugin does not support presets', async () => {
    const result = await getPresetsForPanel('table');

    expect(result).toEqual({ presets: [] });
  });

  it('should return presets for timeseries plugin', async () => {
    const result = await getPresetsForPanel('timeseries');

    expect(result).toHaveProperty('presets');
    expect(Array.isArray(result.presets)).toBe(true);
  });
});
