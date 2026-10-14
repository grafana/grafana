import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { getNextPanelId } from './getNextPanelId';

describe('getNextPanelId', () => {
  it('should get next panel id in a simple 2 panel layout', () => {
    const scene = buildTestScene();
    const id = getNextPanelId(scene);

    expect(id).toBe(3);
  });

  it('should return 1 if no panels are found', () => {
    const scene = buildTestScene();

    const grid = scene.state.body as DefaultGridLayoutManager;
    grid.state.grid.setState({ children: [] });
    const id = getNextPanelId(scene);
    expect(id).toBe(1);
  });
});

function buildTestScene() {
  return new DashboardScene({
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'table' }) }),
          new DashboardGridItem({ body: new VizPanel({ key: 'panel-2', pluginId: 'table' }) }),
        ],
      }),
    }),
  });
}
