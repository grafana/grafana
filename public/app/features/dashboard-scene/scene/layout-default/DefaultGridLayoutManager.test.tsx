import { SceneGridItemLike, SceneGridLayout, SceneGridRow, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { findVizPanelByKey } from '../../utils/utils';

import { DashboardGridItem } from './DashboardGridItem';
import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';

describe('DefaultGridLayoutManager', () => {
  describe('getVizPanels', () => {
    it('Should return all panels', () => {
      const { manager } = setup();
      const vizPanels = manager.getVizPanels();

      expect(vizPanels.length).toBe(4);
      expect(vizPanels[0].state.title).toBe('Panel A');
      expect(vizPanels[1].state.title).toBe('Panel B');
      expect(vizPanels[2].state.title).toBe('Panel C');
      expect(vizPanels[3].state.title).toBe('Panel D');
    });

    it('Should return an empty array when scene has no panels', () => {
      const { manager } = setup({ gridItems: [] });
      const vizPanels = manager.getVizPanels();
      expect(vizPanels.length).toBe(0);
    });
  });

  describe('getNextPanelId', () => {
    it('should get next panel id in a simple 3 panel layout', () => {
      const { manager } = setup();
      const id = manager.getNextPanelId();

      expect(id).toBe(4);
    });

    it('should return 1 if no panels are found', () => {
      const { manager } = setup({ gridItems: [] });
      const id = manager.getNextPanelId();

      expect(id).toBe(1);
    });
  });

  describe('addPanel', () => {
    it('Should add a new panel', () => {
      const { manager } = setup();

      const vizPanel = new VizPanel({
        title: 'Panel Title',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      });

      manager.addPanel(vizPanel);

      const panel = findVizPanelByKey(manager, vizPanel.state.key)!;
      const gridItem = panel.parent as DashboardGridItem;

      expect(panel).toBeDefined();
      expect(gridItem.state.y).toBe(0);
    });
  });

  describe('addNewRow', () => {
    it('Should create and add a new row to the dashboard', () => {
      const { manager, grid } = setup();
      const row = manager.addNewRow();

      expect(grid.state.children.length).toBe(2);
      expect(row.state.key).toBe('panel-4');
      expect(row.state.children[0].state.key).toBe('griditem-1');
      expect(row.state.children[1].state.key).toBe('griditem-2');
    });

    it('Should create a row and add all panels in the dashboard under it', () => {
      const { manager, grid } = setup({
        gridItems: [
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
            key: 'griditem-2',
            body: new VizPanel({
              title: 'Panel B',
              key: 'panel-2',
              pluginId: 'table',
            }),
          }),
        ],
      });

      const row = manager.addNewRow();

      expect(grid.state.children.length).toBe(1);
      expect(row.state.children.length).toBe(2);
    });

    it('Should create and add two new rows, but the second has no children', () => {
      const { manager, grid } = setup();
      const row1 = manager.addNewRow();
      const row2 = manager.addNewRow();

      expect(grid.state.children.length).toBe(3);
      expect(row1.state.children.length).toBe(2);
      expect(row2.state.children.length).toBe(0);
    });

    it('Should create an empty row when nothing else in dashboard', () => {
      const { manager, grid } = setup({ gridItems: [] });
      const row = manager.addNewRow();

      expect(grid.state.children.length).toBe(1);
      expect(row.state.children.length).toBe(0);
    });
  });

  describe('Remove row', () => {
    it('Should remove a row and move its children to the grid layout', () => {
      const { manager, grid } = setup();
      const row = grid.state.children[2] as SceneGridRow;

      manager.removeRow(row);

      expect(grid.state.children.length).toBe(4);
    });

    it('Should remove a row and its children', () => {
      const { manager, grid } = setup();
      const row = grid.state.children[2] as SceneGridRow;

      manager.removeRow(row, true);

      expect(grid.state.children.length).toBe(2);
    });

    it('Should remove an empty row from the layout', () => {
      const row = new SceneGridRow({ key: 'panel-1' });
      const { manager, grid } = setup({ gridItems: [row] });

      manager.removeRow(row);

      expect(grid.state.children.length).toBe(0);
    });
  });

  describe('removePanel', () => {
    it('Should remove grid item', () => {
      const { manager } = setup();
      const panel = findVizPanelByKey(manager, 'panel-1')!;
      manager.removePanel(panel);

      expect(findVizPanelByKey(manager, 'panel-1')).toBeNull();
    });

    it('Should remove a grid item within a row', () => {
      const { manager, grid } = setup();
      const vizPanel = findVizPanelByKey(manager, 'panel-within-row1')!;

      manager.removePanel(vizPanel);

      const gridRow = grid.state.children[2] as SceneGridRow;
      expect(gridRow.state.children.length).toBe(1);
    });
  });

  describe('duplicatePanel', () => {
    it('Should duplicate a panel', () => {
      const { manager, grid } = setup();
      const vizPanel = findVizPanelByKey(manager, 'panel-1')!;

      expect(grid.state.children.length).toBe(3);

      manager.duplicatePanel(vizPanel);

      const newGridItem = grid.state.children[3];

      expect(grid.state.children.length).toBe(4);
      expect(newGridItem.state.key).toBe('grid-item-4');
    });

    it('Should maintain size of duplicated panel', () => {
      const { manager, grid } = setup();

      const gItem = grid.state.children[0] as DashboardGridItem;
      gItem.setState({ height: 1 });

      const vizPanel = gItem.state.body;
      manager.duplicatePanel(vizPanel);

      const newGridItem = grid.state.children[grid.state.children.length - 1] as DashboardGridItem;

      expect(newGridItem.state.height).toBe(1);
      expect(newGridItem.state.itemHeight).toBe(1);
    });

    it('Should duplicate a repeated panel', () => {
      const { manager, grid } = setup();
      const gItem = grid.state.children[0] as DashboardGridItem;
      gItem.setState({ variableName: 'server', repeatDirection: 'v', maxPerRow: 100 });
      const vizPanel = gItem.state.body;
      manager.duplicatePanel(vizPanel as VizPanel);

      const newGridItem = grid.state.children[grid.state.children.length - 1] as DashboardGridItem;

      expect(newGridItem.state.variableName).toBe('server');
      expect(newGridItem.state.repeatDirection).toBe('v');
      expect(newGridItem.state.maxPerRow).toBe(100);
    });

    it('Should duplicate a panel in a row', () => {
      const { manager } = setup();
      const vizPanel = findVizPanelByKey(manager, 'panel-within-row1')!;
      const gridRow = vizPanel.parent?.parent as SceneGridRow;

      expect(gridRow.state.children.length).toBe(2);

      manager.duplicatePanel(vizPanel);

      expect(gridRow.state.children.length).toBe(3);
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
      key: 'griditem-2',
      body: new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    }),
    new SceneGridRow({
      key: 'panel-3',
      title: 'row',
      children: [
        new DashboardGridItem({
          body: new VizPanel({
            title: 'Panel C',
            key: 'panel-within-row1',
            pluginId: 'table',
          }),
        }),
        new DashboardGridItem({
          body: new VizPanel({
            title: 'Panel D',
            key: 'panel-within-row2',
            pluginId: 'table',
          }),
        }),
      ],
    }),
  ];

  const grid = new SceneGridLayout({ children: gridItems });
  const manager = new DefaultGridLayoutManager({ grid: grid });

  return { manager, grid };
}
