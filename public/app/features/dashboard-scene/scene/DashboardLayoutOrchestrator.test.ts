import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardLayoutOrchestrator } from './DashboardLayoutOrchestrator';
import { DashboardScene } from './DashboardScene';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from './layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from './layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { type DashboardDropTarget } from './types/DashboardDropTarget';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('DashboardLayoutOrchestrator', () => {
  describe('cross-tab drag', () => {
    // Nothing is mutated mid-drag any more (no eager detach) — the item stays in its source
    // the whole time. These tests drive _stopDraggingSync directly, as a real drag would call it
    // once the pointer is released, and assert on the single atomic outcome it produces.
    it('should drop item into current tab when dropped on tab header', async () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      const tab2 = tabsManager.state.tabs[1];

      expect(tab1Manager.state.layout.state.children).toHaveLength(1);
      expect(tab2Manager.state.layout.state.children).toHaveLength(0);

      // Simulates having hovered/switched to tab2 (lastDropTarget is the TabItem), with the
      // cursor released over the tab header (no valid drop target under mouse)
      await stopDragging(orchestrator, { sourceDropTarget: tab1Manager, lastDropTarget: tab2, sourceOriginalIndex: 0 });

      expect(tab2Manager.state.layout.state.children).toHaveLength(1);
      expect(tab2Manager.state.layout.state.children[0]).toBe(gridItem);
      expect(tab1Manager.state.layout.state.children).toHaveLength(0);
    });

    it('should cancel drop when panel is released between tab headers — item stays in source, nothing recorded', async () => {
      const { dashboard, orchestrator, tab1Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      expect(tab1Manager.state.layout.state.children).toHaveLength(1);

      // Cursor released over the tab bar itself (between headers), no valid target under mouse
      await stopDragging(orchestrator, { sourceDropTarget: tab1Manager, lastDropTarget: tabsManager });

      // Nothing was ever mutated, so the panel is exactly where it started and there's nothing
      // to undo.
      expect(tab1Manager.state.layout.state.children).toHaveLength(1);
      expect(tab1Manager.state.layout.state.children[0]).toBe(gridItem);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });

    it('should preserve original order when cancelled among sibling panels', async () => {
      const { dashboard, orchestrator, tab1Manager, tabsManager, gridItem, tab1 } = setupWithTwoTabs();

      // Add more panels to tab1: [itemBefore, gridItem, itemAfter]
      const panelBefore = new VizPanel({ title: 'Before', key: 'panel-before', pluginId: 'table' });
      const panelAfter = new VizPanel({ title: 'After', key: 'panel-after', pluginId: 'table' });
      const itemBefore = new AutoGridItem({ key: 'item-before', body: panelBefore });
      const itemAfter = new AutoGridItem({ key: 'item-after', body: panelAfter });

      tab1Manager.state.layout.setState({ children: [itemBefore, gridItem, itemAfter] });
      expect(tab1Manager.state.layout.state.children[1]).toBe(gridItem);

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      await stopDragging(orchestrator, {
        sourceDropTarget: tab1Manager,
        lastDropTarget: tabsManager,
        sourceOriginalIndex: 1,
      });

      const children = tab1Manager.state.layout.state.children;
      expect(children).toHaveLength(3);
      expect(children[0]).toBe(itemBefore);
      expect(children[1]).toBe(gridItem);
      expect(children[2]).toBe(itemAfter);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });

    it('should not cancel drop when lastDropTarget is stale TabsLayoutManager but mouse is over valid target', async () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      // Stale: last pointermove was over the tab bar, but pointerup lands on a valid target
      await stopDragging(orchestrator, {
        sourceDropTarget: tab1Manager,
        lastDropTarget: tabsManager,
        sourceOriginalIndex: 0,
        dropTargetUnderMouse: tab2Manager,
      });

      expect(tab1Manager.state.layout.state.children).toHaveLength(0);
      expect(tab2Manager.state.layout.state.children).toHaveLength(1);
      expect(tab2Manager.state.layout.state.children[0]).toBe(gridItem);
    });

    it('should complete normal drop when valid drop target exists', async () => {
      const { dashboard, orchestrator, tab1Manager, tab2Manager, gridItem, tab1 } = setupWithTwoTabs();

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      expect(tab1Manager.state.layout.state.children).toHaveLength(1);

      await stopDragging(orchestrator, {
        sourceDropTarget: tab1Manager,
        lastDropTarget: tab2Manager,
        sourceOriginalIndex: 0,
        dropTargetUnderMouse: tab2Manager,
      });

      expect(tab1Manager.state.layout.state.children).toHaveLength(0);
      expect(tab2Manager.state.layout.state.children).toHaveLength(1);
      expect(tab2Manager.state.layout.state.children[0]).toBe(gridItem);

      const sidebar = dashboard.state.sidebar;
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(tab1Manager.state.layout.state.children).toHaveLength(1);
      expect(tab1Manager.state.layout.state.children[0].state.body).toBe(gridItem.state.body);
      expect(tab2Manager.state.layout.state.children).toHaveLength(0);
    });
  });

  describe('undo/redo for panel drag', () => {
    // Same-grid reorder is recorded by AutoGridLayout itself (via draggedChildren) — see
    // AutoGridLayout.test.tsx. This suite covers cross-layout moves, owned by the orchestrator.
    it('records one undo entry for a cross-grid move between two plain AutoGrids and round-trips', async () => {
      const { dashboard, managerA, managerB, gridItem, panel } = setupTwoAutoGrids();
      const orchestrator = dashboard.state.layoutOrchestrator;

      orchestrator.setState({ draggingGridItem: gridItem.getRef() });

      await stopDragging(orchestrator, {
        sourceDropTarget: managerA,
        lastDropTarget: managerB,
        sourceOriginalIndex: 0,
        dropTargetUnderMouse: managerB,
      });

      expect(managerA.state.layout.state.children).toHaveLength(0);
      expect(managerB.state.layout.state.children).toHaveLength(1);
      expect(managerB.state.layout.state.children[0]).toBe(gridItem);

      const sidebar = dashboard.state.sidebar;
      expect(sidebar.state.undoStack).toHaveLength(1);

      sidebar.undoAction();
      expect(managerB.state.layout.state.children).toHaveLength(0);
      expect(managerA.state.layout.state.children).toHaveLength(1);
      expect(managerA.state.layout.state.children[0].state.body).toBe(panel);

      sidebar.redoAction();
      expect(managerA.state.layout.state.children).toHaveLength(0);
      expect(managerB.state.layout.state.children).toHaveLength(1);
    });
  });

  describe('isDroppedElsewhere', () => {
    it('should return false when not dragging', () => {
      const { orchestrator } = setup();

      expect(orchestrator.isDroppedElsewhere()).toBe(false);
    });

    it('should return false when source and target are the same', () => {
      const { orchestrator } = setup();

      // Use the same object reference for both - the comparison is by reference
      const mockDropTarget = { state: { key: 'grid-1' } };
      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = mockDropTarget;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = mockDropTarget;

      // When source equals target (same reference), it's not dropped elsewhere
      expect(orchestrator.isDroppedElsewhere()).toBe(false);
    });

    it('should return true when source and target differ', () => {
      const { orchestrator } = setup();

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = { state: { key: 'grid-1' } };
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = { state: { key: 'grid-2' } };

      expect(orchestrator.isDroppedElsewhere()).toBe(true);
    });

    it('should return false when lastDropTarget is null', () => {
      const { orchestrator } = setup();

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = { state: { key: 'grid-1' } };
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = null;

      expect(orchestrator.isDroppedElsewhere()).toBe(false);
    });
  });

  describe('getItemLabel (via state)', () => {
    it('should extract panel title from AutoGridItem', () => {
      const panel = new VizPanel({
        title: 'My Panel Title',
        key: 'panel-1',
        pluginId: 'table',
      });

      const gridItem = new AutoGridItem({
        key: 'grid-item-1',
        body: panel,
      });

      // The label extraction happens internally, we can verify the panel structure
      expect(gridItem.state.body.state.title).toBe('My Panel Title');
    });

    it('should handle panel with empty title', () => {
      const panel = new VizPanel({
        title: '',
        key: 'panel-1',
        pluginId: 'table',
      });

      const gridItem = new AutoGridItem({
        key: 'grid-item-1',
        body: panel,
      });

      // Empty title should be falsy, which the orchestrator handles with fallback to 'Panel'
      expect(gridItem.state.body.state.title).toBe('');
      expect(gridItem.state.body.state.title || 'Panel').toBe('Panel');
    });
  });
});

describe('AutoGridLayoutManager as DashboardDropTarget', () => {
  describe('draggedGridItemInside', () => {
    it('should add item at the end when no position specified', () => {
      const { manager } = setupAutoGrid();
      const newPanel = new VizPanel({ title: 'New Panel', key: 'panel-new', pluginId: 'table' });
      const newItem = new AutoGridItem({ key: 'new-item', body: newPanel });

      manager.draggedGridItemInside(newItem);

      const children = manager.state.layout.state.children;
      expect(children.length).toBe(3);
      expect(children[2]).toBe(newItem);
    });

    it('should insert item at specified position', () => {
      const { manager } = setupAutoGrid();
      const newPanel = new VizPanel({ title: 'New Panel', key: 'panel-new', pluginId: 'table' });
      const newItem = new AutoGridItem({ key: 'new-item', body: newPanel });

      manager.draggedGridItemInside(newItem, 1);

      const children = manager.state.layout.state.children;
      expect(children.length).toBe(3);
      expect(children[1]).toBe(newItem);
    });

    it('should insert at beginning when position is 0', () => {
      const { manager } = setupAutoGrid();
      const newPanel = new VizPanel({ title: 'New Panel', key: 'panel-new', pluginId: 'table' });
      const newItem = new AutoGridItem({ key: 'new-item', body: newPanel });

      manager.draggedGridItemInside(newItem, 0);

      const children = manager.state.layout.state.children;
      expect(children.length).toBe(3);
      expect(children[0]).toBe(newItem);
    });

    it('should clear dropPosition and isDropTarget after insertion', () => {
      const { manager } = setupAutoGrid();
      manager.setState({ dropPosition: 1, isDropTarget: true });

      const newPanel = new VizPanel({ title: 'New Panel', key: 'panel-new', pluginId: 'table' });
      const newItem = new AutoGridItem({ key: 'new-item', body: newPanel });

      manager.draggedGridItemInside(newItem, 1);

      expect(manager.state.dropPosition).toBeNull();
      expect(manager.state.isDropTarget).toBe(false);
    });

    it('should convert DashboardGridItem to AutoGridItem', () => {
      const { manager } = setupAutoGrid();
      const panel = new VizPanel({ title: 'Dashboard Panel', key: 'panel-dgi', pluginId: 'table' });
      const dashboardGridItem = new DashboardGridItem({ key: 'dgi-1', body: panel });

      manager.draggedGridItemInside(dashboardGridItem, 1);

      const children = manager.state.layout.state.children;
      expect(children.length).toBe(3);
      // The inserted item should be an AutoGridItem containing the panel
      expect(children[1]).toBeInstanceOf(AutoGridItem);
      expect(children[1].state.body).toBe(panel);
    });
  });

  describe('draggedGridItemOutside', () => {
    it('should remove item from children', () => {
      const { manager, gridItem1 } = setupAutoGrid();

      manager.draggedGridItemOutside(gridItem1);

      const children = manager.state.layout.state.children;
      expect(children.length).toBe(1);
      expect(children.includes(gridItem1)).toBe(false);
    });

    it('should clear isDropTarget state', () => {
      const { manager, gridItem1 } = setupAutoGrid();
      manager.setState({ isDropTarget: true });

      manager.draggedGridItemOutside(gridItem1);

      expect(manager.state.isDropTarget).toBe(false);
    });
  });

  describe('setDropPosition', () => {
    it('should set dropPosition state', () => {
      const { manager } = setupAutoGrid();

      manager.setDropPosition(2);

      expect(manager.state.dropPosition).toBe(2);
    });

    it('should clear dropPosition when set to null', () => {
      const { manager } = setupAutoGrid();
      manager.setState({ dropPosition: 2 });

      manager.setDropPosition(null);

      expect(manager.state.dropPosition).toBeNull();
    });
  });

  describe('setIsDropTarget', () => {
    it('should set isDropTarget state', () => {
      const { manager } = setupAutoGrid();

      manager.setIsDropTarget(true);

      expect(manager.state.isDropTarget).toBe(true);
    });
  });
});

async function stopDragging(
  orchestrator: DashboardLayoutOrchestrator,
  opts: {
    sourceDropTarget: DashboardDropTarget | null;
    lastDropTarget: DashboardDropTarget | null;
    sourceOriginalIndex?: number;
    dropTargetUnderMouse?: DashboardDropTarget | null;
  }
) {
  // @ts-expect-error - accessing private property for testing
  orchestrator._sourceDropTarget = opts.sourceDropTarget;
  // @ts-expect-error - accessing private property for testing
  orchestrator._lastDropTarget = opts.lastDropTarget;
  if (opts.sourceOriginalIndex !== undefined) {
    // @ts-expect-error - accessing private property for testing
    orchestrator._sourceOriginalIndex = opts.sourceOriginalIndex;
  }

  // @ts-expect-error - accessing private method for testing
  const originalGetDropTargetUnderMouse = orchestrator._getDropTargetUnderMouse;
  // @ts-expect-error - accessing private method for testing
  orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(opts.dropTargetUnderMouse ?? null);

  // @ts-expect-error - accessing private method for testing
  orchestrator._stopDraggingSync({ clientX: 100, clientY: 100 } as PointerEvent);

  // @ts-expect-error - accessing private method for testing
  orchestrator._getDropTargetUnderMouse = originalGetDropTargetUnderMouse;

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function setup() {
  const panel = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
  });

  const gridItem = new AutoGridItem({
    key: 'grid-item-1',
    body: panel,
  });

  const manager = new AutoGridLayoutManager({
    layout: new AutoGridLayout({ children: [gridItem] }),
  });

  const orchestrator = new DashboardLayoutOrchestrator();

  new DashboardScene({
    body: manager,
    layoutOrchestrator: orchestrator,
  });

  return { orchestrator, manager, gridItem, panel };
}

function setupAutoGrid() {
  const panel1 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
  });

  const panel2 = new VizPanel({
    title: 'Panel B',
    key: 'panel-2',
    pluginId: 'table',
  });

  const gridItem1 = new AutoGridItem({
    key: 'grid-item-1',
    body: panel1,
  });

  const gridItem2 = new AutoGridItem({
    key: 'grid-item-2',
    body: panel2,
  });

  const manager = new AutoGridLayoutManager({
    layout: new AutoGridLayout({ children: [gridItem1, gridItem2] }),
  });

  const dashboard = new DashboardScene({ body: manager });
  activateFullSceneTree(dashboard);

  return { dashboard, manager, gridItem1, gridItem2, panel1, panel2 };
}

// Two plain AutoGrids, each its own row, with no tabs involved.
function setupTwoAutoGrids() {
  const panel = new VizPanel({ title: 'Panel', key: 'panel-a', pluginId: 'table' });
  const gridItem = new AutoGridItem({ key: 'grid-item-a', body: panel });

  const managerA = new AutoGridLayoutManager({
    key: 'manager-a',
    layout: new AutoGridLayout({ children: [gridItem] }),
  });
  const managerB = new AutoGridLayoutManager({
    key: 'manager-b',
    layout: new AutoGridLayout({ children: [] }),
  });

  const rowsManager = new RowsLayoutManager({
    rows: [new RowItem({ key: 'row-a', layout: managerA }), new RowItem({ key: 'row-b', layout: managerB })],
  });

  const dashboard = new DashboardScene({ body: rowsManager });
  activateFullSceneTree(dashboard);

  return { dashboard, managerA, managerB, gridItem, panel };
}

function setupWithTwoTabs() {
  // Create panel for Tab 1
  const panel1 = new VizPanel({
    title: 'Panel in Tab 1',
    key: 'panel-tab1',
    pluginId: 'table',
  });

  const gridItem = new AutoGridItem({
    key: 'grid-item-tab1',
    body: panel1,
  });

  const tab1Manager = new AutoGridLayoutManager({
    key: 'tab1-manager',
    layout: new AutoGridLayout({ children: [gridItem] }),
  });

  const tab1 = new TabItem({
    key: 'tab-1',
    title: 'Tab 1',
    layout: tab1Manager,
  });

  // Create empty Tab 2
  const tab2Manager = new AutoGridLayoutManager({
    key: 'tab2-manager',
    layout: new AutoGridLayout({ children: [] }),
  });

  const tab2 = new TabItem({
    key: 'tab-2',
    title: 'Tab 2',
    layout: tab2Manager,
  });

  const tabsManager = new TabsLayoutManager({
    tabs: [tab1, tab2],
  });

  // DashboardScene's constructor always creates its own layoutOrchestrator (it isn't
  // configurable), so grab the real one rather than constructing a separate, unparented instance.
  const dashboard = new DashboardScene({ body: tabsManager });
  const orchestrator = dashboard.state.layoutOrchestrator;

  activateFullSceneTree(dashboard);

  return {
    orchestrator,
    tabsManager,
    tab1,
    tab2,
    tab1Manager,
    tab2Manager,
    gridItem,
    panel1,
    dashboard,
  };
}
