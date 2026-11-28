import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
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

  describe('when dropping onto an empty rows layout', () => {
    function buildEmptyRowsDestinationScene(source: AutoGridLayoutManager | DefaultGridLayoutManager) {
      const destination = new RowsLayoutManager({ key: 'destination', rows: [] });
      const tabsManager = new TabsLayoutManager({
        tabs: [
          new TabItem({ key: 'tab-1', title: 'Tab 1', layout: source }),
          new TabItem({ key: 'tab-2', title: 'Tab 2', layout: destination }),
        ],
      });
      const dashboard = new DashboardScene({ isEditing: true, body: tabsManager });

      return { dashboard, destination, sourceTab: tabsManager.state.tabs[0] };
    }

    function buildAutoGridSourceScene() {
      const panel = new VizPanel({ title: 'Panel', key: 'panel-1', pluginId: 'table' });
      const otherPanel = new VizPanel({ title: 'Other', key: 'panel-2', pluginId: 'table' });
      const gridItem = new AutoGridItem({ key: 'grid-item-1', body: panel });
      const otherGridItem = new AutoGridItem({ key: 'grid-item-2', body: otherPanel });
      const source = new AutoGridLayoutManager({
        key: 'source',
        layout: new AutoGridLayout({ children: [gridItem, otherGridItem] }),
      });

      return { ...buildEmptyRowsDestinationScene(source), source, gridItem, panel, otherGridItem };
    }

    function buildDefaultGridSourceScene() {
      const panel = new VizPanel({ title: 'Panel', key: 'panel-1', pluginId: 'table' });
      const gridItem = new DashboardGridItem({ body: panel, x: 0, y: 0, width: 6, height: 4 });
      const source = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [gridItem], isDraggable: true, isResizable: true }),
      });

      return { ...buildEmptyRowsDestinationScene(source), source, gridItem, panel };
    }

    test('the dragged panel itself, not a clone, is moved into a new row and out of the source', () => {
      const { dashboard, source, destination, gridItem, panel, otherGridItem } = buildAutoGridSourceScene();
      deactivate = activateFullSceneTree(dashboard);

      moveGridItem({ source, destination, gridItem, originalIndex: 0 });

      expect(destination.state.rows).toHaveLength(1);
      const movedPanels = destination.state.rows[0].getLayout().getVizPanels();
      expect(movedPanels).toHaveLength(1);
      expect(movedPanels[0]).toBe(panel);
      expect(source.state.layout.state.children).toHaveLength(1);
      expect(source.state.layout.state.children[0]).toBe(otherGridItem);
    });

    test('undo puts the same panel back at its original index and removes the created row', () => {
      const { dashboard, source, destination, gridItem, panel, otherGridItem } = buildAutoGridSourceScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source, destination, gridItem, originalIndex: 0 });

      dashboard.state.sidebar.undoAction();

      expect(destination.state.rows).toHaveLength(0);
      const children = source.state.layout.state.children;
      expect(children).toHaveLength(2);
      expect(children[0].state.body).toBe(panel);
      expect(children[1]).toBe(otherGridItem);
    });

    test('redo moves the same panel into a new row again', () => {
      const { dashboard, source, destination, gridItem, panel, otherGridItem } = buildAutoGridSourceScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source, destination, gridItem, originalIndex: 0 });
      dashboard.state.sidebar.undoAction();

      dashboard.state.sidebar.redoAction();

      expect(destination.state.rows).toHaveLength(1);
      expect(destination.state.rows[0].getLayout().getVizPanels()[0]).toBe(panel);
      expect(source.state.layout.state.children).toHaveLength(1);
      expect(source.state.layout.state.children[0]).toBe(otherGridItem);
    });

    test('undo from a legacy grid source restores the same grid item with its original position and size', () => {
      const { dashboard, source, destination, gridItem, panel, sourceTab } = buildDefaultGridSourceScene();
      deactivate = activateFullSceneTree(dashboard);
      moveGridItem({ source: sourceTab, destination, gridItem, originalIndex: null });

      expect(source.state.grid.state.children).toHaveLength(0);
      expect(destination.state.rows[0].getLayout().getVizPanels()[0]).toBe(panel);

      dashboard.state.sidebar.undoAction();

      expect(destination.state.rows).toHaveLength(0);
      expect(source.state.grid.state.children).toHaveLength(1);
      expect(source.state.grid.state.children[0]).toBe(gridItem);
      expect(gridItem.state.body).toBe(panel);
      expect(gridItem.state).toMatchObject({ x: 0, y: 0, width: 6, height: 4 });
    });
  });
});
