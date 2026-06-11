describe('built_in_plugins', () => {
  describe('canvas panel', () => {
    it('is included when canvasExternalPlugin is disabled', () => {
      jest.isolateModules(() => {
        jest.mock('@grafana/runtime', () => ({
          config: { featureToggles: { canvasExternalPlugin: false } },
        }));
        const { default: builtInPlugins } = require('./built_in_plugins');
        expect('core:plugin/canvas' in builtInPlugins).toBe(true);
      });
    });

    it('is excluded when canvasExternalPlugin is enabled', () => {
      jest.isolateModules(() => {
        jest.mock('@grafana/runtime', () => ({
          config: { featureToggles: { canvasExternalPlugin: true } },
        }));
        const { default: builtInPlugins } = require('./built_in_plugins');
        expect('core:plugin/canvas' in builtInPlugins).toBe(false);
      });
    });
  });
});
