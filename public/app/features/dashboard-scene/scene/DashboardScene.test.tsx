import { sceneGraph, SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';

describe('DashboardScene', () => {
  describe('Given a standard scene', () => {
    it('Should set inspectPanelKey when url has inspect key', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ inspect: '2' });
      expect(scene.state.inspectPanelId).toBe('2');
    });

    it('Should handle inspect key that is not found', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ inspect: '12321' });
      expect(scene.state.inspectPanelId).toBe(undefined);
    });

    it('Should set viewPanelKey when url has viewPanel', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ viewPanel: '2' });
      expect(scene.state.viewPanelId).toBe('2');
    });
  });

  describe('Editing and discarding', () => {
    describe('Given scene in edit mode', () => {
      let scene: DashboardScene;

      beforeEach(() => {
        scene = buildTestScene();
        scene.onEnterEditMode();
      });

      it('Should set isEditing to true', () => {
        expect(scene.state.isEditing).toBe(true);
      });

      it('A change to griditem pos should set isDirty true', () => {
        const gridItem = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1') as SceneGridItem;
        gridItem.setState({ x: 10, y: 0, width: 10, height: 10 });

        expect(scene.state.isDirty).toBe(true);

        // verify can discard change
        scene.onDiscard();

        const gridItem2 = sceneGraph.findObject(scene, (p) => p.state.key === 'griditem-1') as SceneGridItem;
        expect(gridItem2.state.x).toBe(0);
      });
    });
  });
});

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
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
