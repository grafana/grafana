import * as stable from '../../index';
import * as unstable from '../../unstable';

const graduatedPluginSettingsApis = ['getPluginSettings', 'updateAppPluginSettings', 'usePluginSettings'] as const;

describe('plugin settings APIs', () => {
  it.each(graduatedPluginSettingsApis)('exports %s from the stable entrypoint', (name) => {
    expect(stable[name]).toEqual(expect.any(Function));
  });

  // @grafana/plugin-compat < 0.5.0 silently falls back to the legacy endpoints if these disappear from unstable.
  it.each(graduatedPluginSettingsApis)('keeps %s on the unstable entrypoint as the same function', (name) => {
    expect(unstable[name]).toBe(stable[name]);
  });
});
