import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { moveGridItem } from './moveGridItem';
import { moveToIndex, reorderAutoGridItems } from './reorderAutoGridItems';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

function buildTestScene() {
  const itemA = new AutoGridItem({
    key: 'item-a',
    body: new VizPanel({ title: 'A', key: 'panel-a', pluginId: 'table' }),
  });
  const itemB = new AutoGridItem({
    key: 'item-b',
    body: new VizPanel({ title: 'B', key: 'panel-b', pluginId: 'table' }),
  });
  const layout = new AutoGridLayout({ children: [itemA, itemB] });
  const gridManager = new AutoGridLayoutManager({ layout });
  const dashboard = new DashboardScene({ isEditing: true, body: gridManager });

  return { dashboard, layout, itemA, itemB };
}

describe('moveToIndex', () => {
  function buildItems() {
    const itemA = new AutoGridItem({
      key: 'item-a',
      body: new VizPanel({ title: 'A', key: 'panel-a', pluginId: 'table' }),
    });
    const itemB = new AutoGridItem({
      key: 'item-b',
      body: new VizPanel({ title: 'B', key: 'panel-b', pluginId: 'table' }),
    });
    const itemC = new AutoGridItem({
      key: 'item-c',
      body: new VizPanel({ title: 'C', key: 'panel-c', pluginId: 'table' }),
    });

    return { itemA, itemB, itemC };
  }

  test('moves the item forward to a later index', () => {
    const { itemA, itemB, itemC } = buildItems();

    const result = moveToIndex([itemA, itemB, itemC], 'panel-a', 2);

    expect(result.map((c) => c.state.key)).toEqual(['item-b', 'item-c', 'item-a']);
  });

  test('moves the item backward to an earlier index', () => {
    const { itemA, itemB, itemC } = buildItems();

    const result = moveToIndex([itemA, itemB, itemC], 'panel-c', 0);

    expect(result.map((c) => c.state.key)).toEqual(['item-c', 'item-a', 'item-b']);
  });

  test('is a no-op when the item is already at the target index', () => {
    const { itemA, itemB, itemC } = buildItems();

    const result = moveToIndex([itemA, itemB, itemC], 'panel-b', 1);

    expect(result.map((c) => c.state.key)).toEqual(['item-a', 'item-b', 'item-c']);
  });

  test('clamps an out-of-range index to the end of the array', () => {
    const { itemA, itemB, itemC } = buildItems();

    const result = moveToIndex([itemA, itemB, itemC], 'panel-a', 99);

    expect(result.map((c) => c.state.key)).toEqual(['item-b', 'item-c', 'item-a']);
  });

  test('returns the children unchanged when no item matches the panel key', () => {
    const { itemA, itemB, itemC } = buildItems();
    const children = [itemA, itemB, itemC];

    const result = moveToIndex(children, 'panel-does-not-exist', 0);

    expect(result).toBe(children);
  });

  test('resolves the moved item by panel key rather than by object identity', () => {
    // A cross-layout move can rewrap a panel in a brand new AutoGridItem instance. moveToIndex
    // must still find and relocate it by matching the panel key.
    const { itemA, itemB, itemC } = buildItems();
    itemA.state.body.clearParent();
    const rewrappedA = new AutoGridItem({ key: 'item-a-rewrapped', body: itemA.state.body });

    const result = moveToIndex([itemB, itemC, rewrappedA], 'panel-a', 0);

    expect(result.map((c) => c.state.key)).toEqual(['item-a-rewrapped', 'item-b', 'item-c']);
  });
});

describe('reorderAutoGridItems', () => {
  let deactivate: (() => void) | undefined;

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
  });

  describe('when the order changes', () => {
    test('the layout children are updated to the new order', () => {
      const { dashboard, layout, itemA } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);

      reorderAutoGridItems({ layout, movedItem: itemA, fromIndex: 0, toIndex: 1 });

      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-b', 'item-a']);
    });

    test('the moved panel is not selected', () => {
      const { dashboard, layout, itemA } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);

      reorderAutoGridItems({ layout, movedItem: itemA, fromIndex: 0, toIndex: 1 });

      expect(dashboard.state.sidebar.getSelectedObject()).toBeUndefined();
    });
  });

  describe('when undo is called after reorderAutoGridItems', () => {
    test('the layout children revert to the original order', () => {
      const { dashboard, layout, itemA } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);
      reorderAutoGridItems({ layout, movedItem: itemA, fromIndex: 0, toIndex: 1 });

      dashboard.state.sidebar.undoAction();

      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-a', 'item-b']);
    });
  });

  describe('when redo is called after undo', () => {
    test('the layout children are reordered again', () => {
      const { dashboard, layout, itemA } = buildTestScene();
      deactivate = activateFullSceneTree(dashboard);
      reorderAutoGridItems({ layout, movedItem: itemA, fromIndex: 0, toIndex: 1 });
      dashboard.state.sidebar.undoAction();

      dashboard.state.sidebar.redoAction();

      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-b', 'item-a']);
    });
  });

  describe('when an unrelated cross-layout move is undone in between', () => {
    function buildTabbedScene() {
      const panelA = new VizPanel({ title: 'A', key: 'panel-a', pluginId: 'table' });
      const panelB = new VizPanel({ title: 'B', key: 'panel-b', pluginId: 'table' });
      const itemA = new AutoGridItem({ key: 'item-a', body: panelA });
      const itemB = new AutoGridItem({ key: 'item-b', body: panelB });
      const layout = new AutoGridLayout({ children: [itemA, itemB] });
      const autoGridManager = new AutoGridLayoutManager({ layout });

      const customGridManager = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [], isDraggable: true, isResizable: true }),
      });

      const tab1 = new TabItem({ key: 'tab-1', title: 'Tab 1', layout: autoGridManager });
      const tab2 = new TabItem({ key: 'tab-2', title: 'Tab 2', layout: customGridManager });
      const tabsManager = new TabsLayoutManager({ tabs: [tab1, tab2] });
      const dashboard = new DashboardScene({ isEditing: true, body: tabsManager });

      return { dashboard, layout, itemA, panelA, tab1, tab2 };
    }

    test('the panel stays draggable: its wrapper in the layout matches its actual parent', () => {
      const { dashboard, layout, itemA, panelA, tab1, tab2 } = buildTabbedScene();
      deactivate = activateFullSceneTree(dashboard);

      // Swap A and B within the auto grid layout.
      reorderAutoGridItems({ layout, movedItem: itemA, fromIndex: 0, toIndex: 1 });
      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-b', 'item-a']);

      // Drag A (now at index 1) from the auto grid into the custom grid tab. This rewraps the
      // panel in a DashboardGridItem, so itemA is no longer the panel's wrapper.
      moveGridItem({ source: tab1, destination: tab2, gridItem: itemA, originalIndex: 1 });
      expect(layout.state.children.map((c) => c.state.key)).toEqual(['item-b']);

      // Undo the move: the panel comes back into the auto grid, wrapped in a new AutoGridItem
      // (not itemA).
      dashboard.state.sidebar.undoAction();
      const wrapperAfterFirstUndo = panelA.parent;
      expect(layout.state.children.some((c) => (c as unknown) === wrapperAfterFirstUndo)).toBe(true);

      // Undo the swap: this should just move panel A back to its original position, without
      // leaving the layout holding a stale wrapper that no longer matches panelA.parent.
      dashboard.state.sidebar.undoAction();
      expect(layout.state.children.map((c) => c.state.body.state.key)).toEqual(['panel-a', 'panel-b']);
      expect(layout.state.children.some((c) => (c as unknown) === panelA.parent)).toBe(true);
    });
  });
});
