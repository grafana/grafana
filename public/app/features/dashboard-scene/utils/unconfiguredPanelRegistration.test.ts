import { sceneUtils } from '@grafana/scenes';

import { UNCONFIGURED_PANEL_PLUGIN_ID } from './unconfiguredPanelUtils';
import { getDefaultPluginId } from './utils';

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneUtils: { ...actual.sceneUtils, registerRuntimePanelPlugin: jest.fn() },
  };
});

// UnconfiguredPanel registers its runtime plugin as a module side effect, and `./utils` is the only
// module that pulls it in. Without that import every new panel fails to render with
// "Plugin __unconfigured-panel not found", which no other test catches.
describe('unconfigured panel runtime plugin', () => {
  it('is registered by loading the module that hands out its plugin id', () => {
    expect(getDefaultPluginId).toBeDefined();
    expect(sceneUtils.registerRuntimePanelPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ pluginId: UNCONFIGURED_PANEL_PLUGIN_ID })
    );
  });
});
