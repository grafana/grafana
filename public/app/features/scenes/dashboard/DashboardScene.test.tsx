import { SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';

describe('DashboardScene', () => {
  describe('Given a standard scene', () => {
    it('Should set inspectPanelKey when url has inspect key', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ inspect: 'panel-2' });
      expect(scene.state.inspectPanelKey).toBe('panel-2');
    });

    it('Should handle inspect key that is not found', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ inspect: '12321' });
      expect(scene.state.inspectPanelKey).toBe(undefined);
    });

    it('Should set viewPanelKey when url has viewPanel', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-2' });
      expect(scene.state.viewPanelKey).toBe('panel-2');
    });
  });
});

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel A',
            key: 'panel-1',
            pluginId: 'table',
          }),
        }),
        new SceneGridItem({
          body: new VizPanel({
            title: 'Panel B',
            key: 'panel-2',
            pluginId: 'table',
          }),
        }),
      ],
    }),
  });

  return scene;
}
