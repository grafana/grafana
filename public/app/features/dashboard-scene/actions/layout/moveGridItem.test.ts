import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { type SceneGridItemLike, SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { type LayoutSnapshot, type LayoutSnapshotLayout } from '../../scene/types/DashboardDropTarget';
import { activateFullSceneTree } from '../../utils/test-utils';

import { moveGridItem } from './moveGridItem';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function buildTestScene() {
  const panel = new VizPanel({ title: 'Panel', key: 'panel-1', pluginId: 'table' });
  const gridItem = new AutoGridItem({ key: 'grid-item-1', body: panel });
  const source = new AutoGridLayoutManager({ key: 'source', layout: new AutoGridLayout({ children: [gridItem] }) });
  const destination = new AutoGridLayoutManager({ key: 'destination', layout: new AutoGridLayout({ children: [] }) });
  const tabsManager = new TabsLayoutManager({
    tabs: [
      new TabItem({ key: 'tab-1', title: 'Tab 1', layout: source }),
      new TabItem({ key: 'tab-2', title: 'Tab 2', layout: destination }),
    ],
  });
  const dashboard = new DashboardScene({ isEditing: true, body: tabsManager });

  return { dashboard, source, destination, gridItem, panel };
}

describe('moveGridItem', () => {
  let deactivate: (() => void) | undefined;

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
  });

  describe('when moveGridItem is called', () => {
    test('the panel moves from source to destination', () => {
      const { dashboard, source, destination, gridItem, panel } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);

      moveGridItem({ source, destination, gridItem, originalIndex: 0 });

      expect(source.state.layout.state.children).toHaveLength(0);
      expect(destination.state.layout.state.children).toHaveLength(1);
      expect(destination.state.layout.state.children[0].state.body).toBe(panel);
    });

    test('the panel is not selected', () => {
      const { dashboard, source, destination, gridItem } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);

      moveGridItem({ source, destination, gridItem, originalIndex: 0 });

      expect(dashboard.state.sidebar.getSelectedObject()).toBeUndefined();
    });
  });

  describe('when undo is called after moveGridItem', () => {
    test('the panel moves back to source', () => {
      const { dashboard, source, destination, gridItem, panel } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source, destination, gridItem, originalIndex: 0 });

      dashboard.state.sidebar.undoAction();

      expect(source.state.layout.state.children).toHaveLength(1);
      expect(source.state.layout.state.children[0].state.body).toBe(panel);
      expect(destination.state.layout.state.children).toHaveLength(0);
    });

    test('the panel is still not selected', () => {
      const { dashboard, source, destination, gridItem } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source, destination, gridItem, originalIndex: 0 });

      dashboard.state.sidebar.undoAction();

      expect(dashboard.state.sidebar.getSelectedObject()).toBeUndefined();
    });
  });

  describe('when redo is called after undo', () => {
    test('the panel moves to destination again', () => {
      const { dashboard, source, destination, gridItem, panel } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source, destination, gridItem, originalIndex: 0 });
      dashboard.state.sidebar.undoAction();

      dashboard.state.sidebar.redoAction();

      expect(source.state.layout.state.children).toHaveLength(0);
      expect(destination.state.layout.state.children).toHaveLength(1);
      expect(destination.state.layout.state.children[0].state.body).toBe(panel);
    });
  });

  describe('when layout snapshots are passed', () => {
    function gridItemFor(key: string, x: number, y: number) {
      return new DashboardGridItem({ body: new VizPanel({ key, pluginId: 'table' }), x, y, width: 6, height: 4 });
    }

    function panelKeyOf(child: SceneGridItemLike) {
      return child instanceof DashboardGridItem ? child.state.body.state.key : undefined;
    }

    // Stands in for a grid that positions its items from a snapshot, e.g. the custom grid
    function snapshotTarget(manager: DefaultGridLayoutManager) {
      return {
        applyLayout: (layout: LayoutSnapshotLayout) => {
          for (const child of manager.state.grid.state.children) {
            const item = layout.find((pos) => pos.i === panelKeyOf(child));
            if (item) {
              child.setState({ x: item.x, y: item.y, width: item.w, height: item.h });
            }
          }
        },
      };
    }

    function positionsOf(manager: DefaultGridLayoutManager) {
      return Object.fromEntries(
        manager.state.grid.state.children.map((child) => [
          panelKeyOf(child),
          [child.state.x, child.state.y, child.state.width, child.state.height],
        ])
      );
    }

    function buildSnapshotScene() {
      const gridItem = gridItemFor('moved', 0, 0);
      const source = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [gridItem, gridItemFor('source-other', 6, 0)] }),
      });
      const destination = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [gridItemFor('destination-other', 0, 0)] }),
      });
      const tabsManager = new TabsLayoutManager({
        tabs: [
          new TabItem({ key: 'tab-1', title: 'Tab 1', layout: source }),
          new TabItem({ key: 'tab-2', title: 'Tab 2', layout: destination }),
        ],
      });
      const dashboard = new DashboardScene({ isEditing: true, body: tabsManager });
      const [tab1, tab2] = tabsManager.state.tabs;

      const layoutSnapshots: LayoutSnapshot[] = [
        {
          target: snapshotTarget(source),
          before: [
            { i: 'moved', x: 0, y: 0, w: 6, h: 4 },
            { i: 'source-other', x: 6, y: 0, w: 6, h: 4 },
          ],
          after: [{ i: 'source-other', x: 0, y: 0, w: 6, h: 4 }],
        },
        {
          target: snapshotTarget(destination),
          before: [{ i: 'destination-other', x: 0, y: 0, w: 6, h: 4 }],
          after: [
            { i: 'moved', x: 3, y: 0, w: 9, h: 5 },
            { i: 'destination-other', x: 0, y: 5, w: 6, h: 4 },
          ],
        },
      ];

      return { dashboard, source, destination, gridItem, tab1, tab2, layoutSnapshots };
    }

    test('the "after" positions are applied in source and destination', () => {
      const { dashboard, source, destination, gridItem, tab1, tab2, layoutSnapshots } = buildSnapshotScene();
      deactivate = activateFullSceneTree(dashboard);

      moveGridItem({ source: tab1, destination: tab2, gridItem, originalIndex: 0, layoutSnapshots });

      expect(positionsOf(source)).toEqual({ 'source-other': [0, 0, 6, 4] });
      expect(positionsOf(destination)).toEqual({ moved: [3, 0, 9, 5], 'destination-other': [0, 5, 6, 4] });
    });

    test('undo restores the "before" positions in source and destination', () => {
      const { dashboard, source, destination, gridItem, tab1, tab2, layoutSnapshots } = buildSnapshotScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source: tab1, destination: tab2, gridItem, originalIndex: 0, layoutSnapshots });

      dashboard.state.sidebar.undoAction();

      expect(positionsOf(source)).toEqual({ moved: [0, 0, 6, 4], 'source-other': [6, 0, 6, 4] });
      expect(positionsOf(destination)).toEqual({ 'destination-other': [0, 0, 6, 4] });
    });

    test('redo applies the "after" positions again', () => {
      const { dashboard, source, destination, gridItem, tab1, tab2, layoutSnapshots } = buildSnapshotScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source: tab1, destination: tab2, gridItem, originalIndex: 0, layoutSnapshots });
      dashboard.state.sidebar.undoAction();

      dashboard.state.sidebar.redoAction();

      expect(positionsOf(source)).toEqual({ 'source-other': [0, 0, 6, 4] });
      expect(positionsOf(destination)).toEqual({ moved: [3, 0, 9, 5], 'destination-other': [0, 5, 6, 4] });
    });
  });

  describe('when moving between grid types that convert the wrapper (legacy grid <-> auto grid)', () => {
    function buildMixedGridScene() {
      const panel = new VizPanel({ title: 'Panel', key: 'panel-1', pluginId: 'table' });
      const gridItem = new DashboardGridItem({ body: panel, x: 0, y: 0, width: 12, height: 8 });
      const source = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [gridItem], isDraggable: true, isResizable: true }),
      });
      const destination = new AutoGridLayoutManager({
        key: 'destination',
        layout: new AutoGridLayout({ children: [] }),
      });
      const tabsManager = new TabsLayoutManager({
        tabs: [
          new TabItem({ key: 'tab-1', title: 'Tab 1', layout: source }),
          new TabItem({ key: 'tab-2', title: 'Tab 2', layout: destination }),
        ],
      });
      const dashboard = new DashboardScene({ isEditing: true, body: tabsManager });

      return { dashboard, source, destination, gridItem, panel, tab1: tabsManager.state.tabs[0] };
    }

    test('redo after undo does not leave a stale wrapper behind in source', () => {
      const { dashboard, source, destination, gridItem, panel, tab1 } = buildMixedGridScene();
      deactivate = activateFullSceneTree(dashboard);

      moveGridItem({ source: tab1, destination, gridItem, originalIndex: 0 });
      dashboard.state.sidebar.undoAction();
      dashboard.state.sidebar.redoAction();

      expect(source.state.grid.state.children).toHaveLength(0);
      expect(destination.state.layout.state.children).toHaveLength(1);
      expect(destination.state.layout.state.children[0].state.body).toBe(panel);
    });
  });
});
