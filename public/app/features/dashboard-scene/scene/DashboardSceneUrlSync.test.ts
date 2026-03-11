import { SceneGridLayout, SceneGridRow, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

describe('DashboardSceneUrlSync', () => {
  describe('Given a standard scene', () => {
    it('Should set UNSAFE_fitPanels when url has autofitpanels', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ autofitpanels: '' });
      const layout = scene.state.body as DefaultGridLayoutManager;

      expect(layout.state.grid.state.UNSAFE_fitPanels).toBe(true);
    });

    it('Should get the autofitpanels from the scene state', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().autofitpanels).toBeUndefined();
      const layout = scene.state.body as DefaultGridLayoutManager;
      layout.state.grid.setState({ UNSAFE_fitPanels: true });
      expect(scene.urlSync?.getUrlState().autofitpanels).toBe('true');
    });

    it('Should expand all collapsed rows when url has expandRows', () => {
      const row = new SceneGridRow({
        key: 'row-1',
        title: 'Row 1',
        isCollapsed: true,
        children: [
          new DashboardGridItem({
            body: new VizPanel({ title: 'Panel C', key: 'panel-3', pluginId: 'table' }),
          }),
        ],
      });

      const grid = new SceneGridLayout({
        children: [
          new DashboardGridItem({
            body: new VizPanel({ title: 'Panel A', key: 'panel-1', pluginId: 'table' }),
          }),
          row,
        ],
      });

      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new DefaultGridLayoutManager({ grid }),
      });

      expect(row.state.isCollapsed).toBe(true);
      scene.urlSync?.updateFromUrl({ expandRows: '' });
      expect(row.state.isCollapsed).toBe(false);
    });
  });

  describe('entering edit mode', () => {
    it('it should be possible to go from the view panel view to the edit view when the dashboard is not in edit mdoe', () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false });
      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });
      expect(scene.state.viewPanel).toBeDefined();
      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
      expect(scene.state.editPanel).toBeDefined();
    });
  });
});

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),

      new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    ]),
  });

  return scene;
}
