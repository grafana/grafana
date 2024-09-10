import { SceneGridItemLike, SceneGridLayout, SceneGridRow, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../DashboardGridItem';

import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';

describe('DefaultGridLayoutManager', () => {
  describe('getVizPanels', () => {
    it('Should return all panels', () => {
      const layout = setup();
      const vizPanels = layout.getVizPanels();

      expect(vizPanels.length).toBe(4);
      expect(vizPanels[0].state.title).toBe('Panel A');
      expect(vizPanels[1].state.title).toBe('Panel B');
      expect(vizPanels[2].state.title).toBe('Panel C');
      expect(vizPanels[3].state.title).toBe('Panel D');
    });

    it('Should return an empty array when scene has no panels', () => {
      const layout = setup({ gridItems: [] });
      const vizPanels = layout.getVizPanels();
      expect(vizPanels.length).toBe(0);
    });
  });

  describe('getNextPanelId', () => {
    it('should get next panel id in a simple 3 panel layout', () => {
      const layout = setup();
      const id = layout.getNextPanelId();

      expect(id).toBe(3);
    });

    it('should return 1 if no panels are found', () => {
      const layout = setup({ gridItems: [] });
      const id = layout.getNextPanelId();

      expect(id).toBe(1);
    });
  });

  describe('removeElement', () => {
    it('should remove element', () => {
      const layout = setup();

      expect(layout.state.layout.state.children.length).toBe(3);

      layout.removeElement(layout.state.layout.state.children[0] as DashboardGridItem);

      expect(layout.state.layout.state.children.length).toBe(2);
    });
  });
});

interface TestOptions {
  gridItems: SceneGridItemLike[];
}

function setup(options?: TestOptions) {
  const gridItems = options?.gridItems ?? [
    new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      body: new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),
    }),
    new DashboardGridItem({
      body: new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    }),
    new SceneGridRow({
      key: 'key',
      title: 'row',
      children: [
        new DashboardGridItem({
          body: new VizPanel({
            title: 'Panel C',
            key: 'panel-2-clone-2',
            pluginId: 'table',
          }),
        }),
        new DashboardGridItem({
          body: new VizPanel({
            title: 'Panel D',
            key: 'panel-2-clone-2',
            pluginId: 'table',
          }),
        }),
      ],
    }),
  ];

  const layout = new DefaultGridLayoutManager({
    layout: new SceneGridLayout({ children: gridItems }),
  });

  return layout;
}
