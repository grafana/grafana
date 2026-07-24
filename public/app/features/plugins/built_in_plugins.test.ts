describe('built_in_plugins', () => {
  describe('canvas panel', () => {
    it('is included when no panel has canvas in aliasIDs', () => {
      jest.isolateModules(() => {
        jest.mock('@grafana/runtime/internal', () => ({
          getPanelPluginMetasMapSync: () => ({}),
        }));
        const { default: builtInPlugins } = require('./built_in_plugins');
        expect(Boolean(builtInPlugins['core:plugin/canvas'])).toBe(true);
      });
    });

    it('is excluded when a panel declares canvas in aliasIDs', () => {
      jest.isolateModules(() => {
        jest.mock('@grafana/runtime/internal', () => ({
          getPanelPluginMetasMapSync: () => ({
            'grafana-canvas-panel': { id: 'grafana-canvas-panel', aliasIDs: ['canvas'] },
          }),
        }));
        const { default: builtInPlugins } = require('./built_in_plugins');
        expect(Boolean(builtInPlugins['core:plugin/canvas'])).toBe(false);
      });
    });
  });
});
