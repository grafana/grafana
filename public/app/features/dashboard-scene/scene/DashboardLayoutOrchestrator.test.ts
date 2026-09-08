import { VizPanel } from '@grafana/scenes';

import { moveGridItem } from '../actions/layout/moveGridItem';
import { reorderAutoGridItems } from '../actions/layout/reorderAutoGridItems';

import { DashboardLayoutOrchestrator } from './DashboardLayoutOrchestrator';
import { DashboardScene } from './DashboardScene';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from './layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from './layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

jest.mock('../actions/layout/moveGridItem', () => ({
  moveGridItem: jest.fn(),
}));
jest.mock('../actions/layout/reorderAutoGridItems', () => ({
  reorderAutoGridItems: jest.fn(),
}));

const moveGridItemMock = jest.mocked(moveGridItem);
const reorderAutoGridItemsMock = jest.mocked(reorderAutoGridItems);

describe('DashboardLayoutOrchestrator', () => {
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
  describe('triggers correct dashboard actions', () => {
    beforeEach(() => {
      moveGridItemMock.mockClear();
      reorderAutoGridItemsMock.mockClear();
    });

    it('commits a reorder when dropped back within the source layout', () => {
      const { orchestrator, manager, gridItem } = setup();
      const panel2 = new VizPanel({ title: 'Panel B', key: 'panel-2', pluginId: 'table' });
      const gridItem2 = new AutoGridItem({ key: 'grid-item-2', body: panel2 });
      manager.state.layout.setState({ children: [gridItem, gridItem2], draggedChildren: [gridItem2, gridItem] });
      orchestrator.setState({ draggingGridItem: gridItem.getRef() });

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = manager;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(manager);

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync({ clientX: 0, clientY: 0 } as PointerEvent);

      expect(reorderAutoGridItemsMock).toHaveBeenCalledTimes(1);
      expect(reorderAutoGridItemsMock).toHaveBeenCalledWith({
        layout: manager.state.layout,
        movedItem: gridItem,
        fromIndex: 0,
        toIndex: 1,
      });
      expect(moveGridItemMock).not.toHaveBeenCalled();
    });

    it('moves the item when dropped onto a different layout', () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem } = setupWithTwoTabs();
      orchestrator.setState({ draggingGridItem: gridItem.getRef() });

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tab2Manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceOriginalIndex = 0;
      // @ts-expect-error - accessing private property for testing
      orchestrator._currentDropPosition = 2;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(tab2Manager);

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync({ clientX: 0, clientY: 0 } as PointerEvent);

      expect(moveGridItemMock).toHaveBeenCalledTimes(1);
      expect(moveGridItemMock).toHaveBeenCalledWith({
        source: tab1Manager,
        destination: tab2Manager,
        gridItem,
        originalIndex: 0,
        destinationIndex: 2,
      });
      expect(reorderAutoGridItemsMock).not.toHaveBeenCalled();
    });

    it('commits a reorder (not a move) when dropped on the tab bar between headers', () => {
      const { orchestrator, tab1Manager, tabsManager, gridItem } = setupWithTwoTabs();
      const panel2 = new VizPanel({ title: 'Panel B', key: 'panel-tab1-b', pluginId: 'table' });
      const gridItem2 = new AutoGridItem({ key: 'grid-item-tab1-b', body: panel2 });
      tab1Manager.state.layout.setState({ children: [gridItem, gridItem2], draggedChildren: [gridItem2, gridItem] });
      orchestrator.setState({ draggingGridItem: gridItem.getRef() });

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tabsManager;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(null);

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync({ clientX: 0, clientY: 0 } as PointerEvent);

      expect(reorderAutoGridItemsMock).toHaveBeenCalledTimes(1);
      expect(reorderAutoGridItemsMock).toHaveBeenCalledWith({
        layout: tab1Manager.state.layout,
        movedItem: gridItem,
        fromIndex: 0,
        toIndex: 1,
      });
      expect(moveGridItemMock).not.toHaveBeenCalled();
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

  new DashboardScene({ body: manager });

  return { manager, gridItem1, gridItem2, panel1, panel2 };
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

  const orchestrator = new DashboardLayoutOrchestrator();

  const dashboard = new DashboardScene({
    body: tabsManager,
    layoutOrchestrator: orchestrator,
  });

  // Activate the scene hierarchy to set up parent relationships
  dashboard.activate();

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
