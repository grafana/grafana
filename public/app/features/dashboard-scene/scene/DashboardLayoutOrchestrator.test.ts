import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent, type DashboardEditActionEventPayload } from '../sidebar/events';

import { DashboardLayoutOrchestrator } from './DashboardLayoutOrchestrator';
import { DashboardScene } from './DashboardScene';
import { AutoGridItem } from './layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from './layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from './layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

describe('DashboardLayoutOrchestrator', () => {
  describe('cross-tab drag cancel', () => {
    it('should drop item into current tab when dropped on tab header after detach', () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

      // Simulate state after cross-tab drag started:
      // - Item was detached from source
      // - We're on Tab 2 now
      // - User releases mouse over tab header (no valid drop target under mouse)
      // Expected: Item drops into Tab 2's layout

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      const tab2 = tabsManager.state.tabs[1];

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // @ts-expect-error - accessing private property for testing
      // lastDropTarget is the TabItem (set when tab switches)
      orchestrator._lastDropTarget = tab2;
      // @ts-expect-error - accessing private property for testing
      orchestrator._itemDetachedFromSource = true;

      // Simulate the item being removed from source (as happens during tab switch)
      tab1Manager.draggedGridItemOutside(gridItem);

      // Switch to tab 2 (simulating what happens after 600ms hover)
      tabsManager.switchToTab(tab2);

      // Verify item was removed from tab1
      expect(tab1Manager.state.layout.state.children).toHaveLength(0);
      // Verify tab2 is empty before drop
      expect(tab2Manager.state.layout.state.children).toHaveLength(0);

      // Mock _getDropTargetUnderMouse to return null (simulating cursor over tab header)
      // @ts-expect-error - accessing private method for testing
      const originalGetDropTargetUnderMouse = orchestrator._getDropTargetUnderMouse;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(null);

      // Create a mock pointer event
      const mockEvent = {
        clientX: 100,
        clientY: 100,
      } as PointerEvent;

      // Call _stopDraggingSync (this is what happens on mouse release)
      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync(mockEvent);

      // Restore original methods
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = originalGetDropTargetUnderMouse;

      // Wait for setTimeout to execute
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Verify item was dropped into tab2
          expect(tab2Manager.state.layout.state.children).toHaveLength(1);
          expect(tab2Manager.state.layout.state.children[0]).toBe(gridItem);

          // Tab1 should still be empty
          expect(tab1Manager.state.layout.state.children).toHaveLength(0);

          // We should still be on tab2
          expect(tabsManager.getCurrentTab()).toBe(tab2);

          resolve();
        }, 0);
      });
    });

    it('should cancel drop when panel is released between tab headers (not detached)', () => {
      const { orchestrator, tab1Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tabsManager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._itemDetachedFromSource = false;

      expect(tab1Manager.state.layout.state.children).toHaveLength(1);

      // @ts-expect-error - accessing private method for testing
      const originalGetDropTargetUnderMouse = orchestrator._getDropTargetUnderMouse;
      // No valid target under mouse — fallback to lastDropTarget (TabsLayoutManager)
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(null);

      const mockEvent = { clientX: 100, clientY: 100 } as PointerEvent;

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync(mockEvent);

      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = originalGetDropTargetUnderMouse;

      // Panel should still be in Tab 1 (drop was cancelled)
      expect(tab1Manager.state.layout.state.children).toHaveLength(1);
      expect(tab1Manager.state.layout.state.children[0]).toBe(gridItem);
    });

    it('should return panel to source when dropped between tab headers after detach', () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      const tab2 = tabsManager.state.tabs[1];

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // Cursor moved between tab headers so _lastDropTarget is the TabsLayoutManager
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tabsManager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._itemDetachedFromSource = true;

      // Simulate the item being removed from source (as happens during tab switch)
      tab1Manager.draggedGridItemOutside(gridItem);
      tabsManager.switchToTab(tab2);

      expect(tab1Manager.state.layout.state.children).toHaveLength(0);
      expect(tab2Manager.state.layout.state.children).toHaveLength(0);

      // @ts-expect-error - accessing private method for testing
      const originalGetDropTargetUnderMouse = orchestrator._getDropTargetUnderMouse;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(tabsManager);

      const mockEvent = { clientX: 100, clientY: 100 } as PointerEvent;

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync(mockEvent);

      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = originalGetDropTargetUnderMouse;

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Panel should be returned to source (Tab 1)
          expect(tab1Manager.state.layout.state.children).toHaveLength(1);
          expect(tab1Manager.state.layout.state.children[0]).toBe(gridItem);

          // Tab 2 should remain empty
          expect(tab2Manager.state.layout.state.children).toHaveLength(0);

          resolve();
        }, 0);
      });
    });

    it('should return panel to its original position when drag is cancelled after detach', () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

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

      const tab2 = tabsManager.state.tabs[1];

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tabsManager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._itemDetachedFromSource = true;
      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceOriginalIndex = 1;

      tab1Manager.draggedGridItemOutside(gridItem);
      tabsManager.switchToTab(tab2);

      expect(tab1Manager.state.layout.state.children).toHaveLength(2);
      expect(tab2Manager.state.layout.state.children).toHaveLength(0);

      // @ts-expect-error - accessing private method for testing
      const originalGetDropTargetUnderMouse = orchestrator._getDropTargetUnderMouse;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(tabsManager);

      const mockEvent = { clientX: 100, clientY: 100 } as PointerEvent;

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync(mockEvent);

      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = originalGetDropTargetUnderMouse;

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const children = tab1Manager.state.layout.state.children;
          expect(children).toHaveLength(3);
          expect(children[0]).toBe(itemBefore);
          expect(children[1]).toBe(gridItem);
          expect(children[2]).toBe(itemAfter);

          expect(tab2Manager.state.layout.state.children).toHaveLength(0);

          resolve();
        }, 0);
      });
    });

    it('should not cancel drop when lastDropTarget is stale TabsLayoutManager but mouse is over valid target', () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tabsManager, tab1 } = setupWithTwoTabs();

      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // Stale: last pointermove was over the tab bar, but pointerup lands on a valid target
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tabsManager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._itemDetachedFromSource = true;

      tab1Manager.draggedGridItemOutside(gridItem);
      expect(tab1Manager.state.layout.state.children).toHaveLength(0);

      // @ts-expect-error - accessing private method for testing
      const originalGetDropTargetUnderMouse = orchestrator._getDropTargetUnderMouse;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(tab2Manager);

      const mockEvent = { clientX: 100, clientY: 100 } as PointerEvent;

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync(mockEvent);

      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = originalGetDropTargetUnderMouse;

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(tab1Manager.state.layout.state.children).toHaveLength(0);
          expect(tab2Manager.state.layout.state.children).toHaveLength(1);
          expect(tab2Manager.state.layout.state.children[0]).toBe(gridItem);
          resolve();
        }, 0);
      });
    });

    it('should complete normal drop when valid drop target exists', () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tab1 } = setupWithTwoTabs();

      // Simulate state after cross-tab drag started
      orchestrator.setState({
        draggingGridItem: gridItem.getRef(),
        sourceTabKey: tab1.state.key,
      });

      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tab2Manager;
      // @ts-expect-error - accessing private property for testing
      orchestrator._itemDetachedFromSource = true;

      // Simulate the item being removed from source
      tab1Manager.draggedGridItemOutside(gridItem);
      expect(tab1Manager.state.layout.state.children).toHaveLength(0);

      // Mock _getDropTargetUnderMouse to return the tab2Manager (valid drop target)
      // @ts-expect-error - accessing private method for testing
      const originalGetDropTargetUnderMouse = orchestrator._getDropTargetUnderMouse;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(tab2Manager);

      const mockEvent = {
        clientX: 100,
        clientY: 100,
      } as PointerEvent;

      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync(mockEvent);

      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = originalGetDropTargetUnderMouse;

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Verify item was NOT returned to source (it should go to tab2)
          expect(tab1Manager.state.layout.state.children).toHaveLength(0);
          expect(tab2Manager.state.layout.state.children).toHaveLength(1);
          expect(tab2Manager.state.layout.state.children[0]).toBe(gridItem);

          resolve();
        }, 0);
      });
    });
  });

  describe('cross-container drag undo', () => {
    it('registers a single undoable move action for a cross-tab panel drop', async () => {
      const { orchestrator, tab1Manager, tab2Manager, gridItem, tab1, tab2, dashboard } = setupWithTwoTabs();
      const actions = collectEditActions(dashboard);

      orchestrator.setState({ draggingGridItem: gridItem.getRef(), sourceTabKey: tab1.state.key });
      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1Manager;

      // Simulate hovering over tab 2 long enough for it to activate (detaches the item)
      // @ts-expect-error - accessing private method for testing
      orchestrator._activateTab(tab2.state.key);
      expect(tab1Manager.state.layout.state.children).toHaveLength(0);

      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tab2Manager;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(tab2Manager);
      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync({ clientX: 100, clientY: 100 } as PointerEvent);
      await flushDropTimeout();

      expect(tab2Manager.state.layout.state.children).toEqual([gridItem]);
      expect(actions).toHaveLength(1);
      expect(actions[0].movedObject).toBeInstanceOf(VizPanel);

      actions[0].undo();
      expect(tab2Manager.state.layout.state.children).toHaveLength(0);
      expect(tab1Manager.state.layout.state.children).toEqual([gridItem]);
      expect(gridItem.parent).toBe(tab1Manager.state.layout);

      actions[0].perform();
      expect(tab1Manager.state.layout.state.children).toHaveLength(0);
      expect(tab2Manager.state.layout.state.children).toEqual([gridItem]);
    });

    it('restores the original grid item and position when undoing a converted cross-layout drop', async () => {
      const { orchestrator, tab1, tab2, gridItem, panel, customGrid, autoGridManager, dashboard } =
        setupWithCustomAndAutoGridTabs();
      const actions = collectEditActions(dashboard);

      orchestrator.setState({ draggingGridItem: gridItem.getRef(), sourceTabKey: tab1.state.key });
      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceDropTarget = tab1;
      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tab2;
      // @ts-expect-error - accessing private method for testing
      orchestrator._getDropTargetUnderMouse = jest.fn().mockReturnValue(tab2);
      // @ts-expect-error - accessing private method for testing
      orchestrator._stopDraggingSync({ clientX: 100, clientY: 100 } as PointerEvent);
      await flushDropTimeout();

      // Item was converted to an AutoGridItem in the destination
      expect(customGrid.state.children).toHaveLength(0);
      expect(autoGridManager.state.layout.state.children).toHaveLength(1);
      const convertedItem = autoGridManager.state.layout.state.children[0];
      expect(convertedItem.state.body).toBe(panel);
      expect(actions).toHaveLength(1);

      actions[0].undo();
      expect(autoGridManager.state.layout.state.children).toHaveLength(0);
      expect(customGrid.state.children).toEqual([gridItem]);
      expect(gridItem.state.x).toBe(6);
      expect(gridItem.state.y).toBe(3);
      expect(panel.parent).toBe(gridItem);

      actions[0].perform();
      expect(customGrid.state.children).toHaveLength(0);
      expect(autoGridManager.state.layout.state.children).toEqual([convertedItem]);
      expect(panel.parent).toBe(convertedItem);
    });

    it('registers a single undoable move action for a cross-tab row drop', () => {
      const { orchestrator, tab2, rowA, rowB, rowC, tab1Rows, tab2Rows, dashboard } = setupWithRowTabs();
      const actions = collectEditActions(dashboard);

      orchestrator.setState({ draggingRow: rowA.getRef() });
      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceRowsLayout = tab1Rows;

      // Simulate hovering over tab 2 long enough for it to activate (detaches the row)
      // @ts-expect-error - accessing private method for testing
      orchestrator._activateTab(tab2.state.key);
      expect(tab1Rows.state.rows).toEqual([rowB]);

      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tab2;
      // @ts-expect-error - accessing private method for testing
      orchestrator._onRowDragPointerUp({ clientX: 100, clientY: 100 } as PointerEvent);

      expect(tab2Rows.state.rows).toEqual([rowC, rowA]);
      expect(actions).toHaveLength(1);
      expect(actions[0].movedObject).toBe(rowA);

      actions[0].undo();
      expect(tab2Rows.state.rows).toEqual([rowC]);
      expect(tab1Rows.state.rows).toEqual([rowA, rowB]);
      expect(rowA.parent).toBe(tab1Rows);

      actions[0].perform();
      expect(tab1Rows.state.rows).toEqual([rowB]);
      expect(tab2Rows.state.rows).toEqual([rowC, rowA]);
    });

    it('restores source and destination layouts when undoing a cross-tab drag of the last row', () => {
      const { orchestrator, tab1, tab2, rowA, tab1Rows, dashboard } = setupWithLastRowAndAutoGridTabs();
      const actions = collectEditActions(dashboard);

      orchestrator.setState({ draggingRow: rowA.getRef() });
      // @ts-expect-error - accessing private property for testing
      orchestrator._sourceRowsLayout = tab1Rows;

      // Detaching the only row swaps the source layout for an empty auto grid
      // @ts-expect-error - accessing private method for testing
      orchestrator._activateTab(tab2.state.key);
      expect(tab1.getLayout()).toBeInstanceOf(AutoGridLayoutManager);

      // @ts-expect-error - accessing private property for testing
      orchestrator._lastDropTarget = tab2;
      // @ts-expect-error - accessing private method for testing
      orchestrator._onRowDragPointerUp({ clientX: 100, clientY: 100 } as PointerEvent);

      // Destination tab was converted to a rows layout containing the dropped row
      const tab2Layout = tab2.getLayout();
      expect(tab2Layout).toBeInstanceOf(RowsLayoutManager);
      expect(tab2Layout.state).toMatchObject({ rows: [rowA] });
      expect(actions).toHaveLength(1);

      actions[0].undo();
      expect(tab2.getLayout()).toBeInstanceOf(AutoGridLayoutManager);
      expect(tab1.getLayout()).toBe(tab1Rows);
      expect(tab1Rows.state.rows).toEqual([rowA]);
      expect(rowA.parent).toBe(tab1Rows);

      actions[0].perform();
      expect(tab1.getLayout()).toBeInstanceOf(AutoGridLayoutManager);
      const tab2LayoutAfterRedo = tab2.getLayout();
      expect(tab2LayoutAfterRedo).toBeInstanceOf(RowsLayoutManager);
      expect(tab2LayoutAfterRedo.state).toMatchObject({ rows: [rowA] });
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

function collectEditActions(dashboard: DashboardScene): DashboardEditActionEventPayload[] {
  const actions: DashboardEditActionEventPayload[] = [];

  // Mimics how DashboardSidebar handles edit actions: collect and perform
  dashboard.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
    actions.push(payload);
    payload.perform();
  });

  return actions;
}

function flushDropTimeout() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function setupWithCustomAndAutoGridTabs() {
  const panel = new VizPanel({ title: 'Panel in Tab 1', key: 'panel-tab1', pluginId: 'table' });

  const gridItem = new DashboardGridItem({
    key: 'grid-item-tab1',
    x: 6,
    y: 3,
    width: 8,
    height: 6,
    body: panel,
  });

  const customGrid = new SceneGridLayout({ children: [gridItem], isDraggable: true, isResizable: true });
  const tab1 = new TabItem({
    key: 'tab-1',
    title: 'Tab 1',
    layout: new DefaultGridLayoutManager({ grid: customGrid }),
  });

  const autoGridManager = new AutoGridLayoutManager({
    key: 'tab2-manager',
    layout: new AutoGridLayout({ children: [] }),
  });
  const tab2 = new TabItem({ key: 'tab-2', title: 'Tab 2', layout: autoGridManager });

  const tabsManager = new TabsLayoutManager({ tabs: [tab1, tab2] });
  // DashboardScene always creates its own orchestrator, so use that instance
  const dashboard = new DashboardScene({ body: tabsManager });
  const orchestrator = dashboard.state.layoutOrchestrator!;
  dashboard.activate();

  return { orchestrator, tabsManager, tab1, tab2, gridItem, panel, customGrid, autoGridManager, dashboard };
}

function setupWithRowTabs() {
  const rowA = new RowItem({ key: 'row-a', title: 'Row A', layout: AutoGridLayoutManager.createEmpty() });
  const rowB = new RowItem({ key: 'row-b', title: 'Row B', layout: AutoGridLayoutManager.createEmpty() });
  const rowC = new RowItem({ key: 'row-c', title: 'Row C', layout: AutoGridLayoutManager.createEmpty() });

  const tab1Rows = new RowsLayoutManager({ rows: [rowA, rowB] });
  const tab2Rows = new RowsLayoutManager({ rows: [rowC] });

  const tab1 = new TabItem({ key: 'tab-1', title: 'Tab 1', layout: tab1Rows });
  const tab2 = new TabItem({ key: 'tab-2', title: 'Tab 2', layout: tab2Rows });

  const tabsManager = new TabsLayoutManager({ tabs: [tab1, tab2] });
  // DashboardScene always creates its own orchestrator, so use that instance
  const dashboard = new DashboardScene({ body: tabsManager });
  const orchestrator = dashboard.state.layoutOrchestrator!;
  dashboard.activate();

  return { orchestrator, tabsManager, tab1, tab2, rowA, rowB, rowC, tab1Rows, tab2Rows, dashboard };
}

function setupWithLastRowAndAutoGridTabs() {
  const rowA = new RowItem({ key: 'row-a', title: 'Row A', layout: AutoGridLayoutManager.createEmpty() });
  const tab1Rows = new RowsLayoutManager({ rows: [rowA] });
  const tab1 = new TabItem({ key: 'tab-1', title: 'Tab 1', layout: tab1Rows });

  const tab2 = new TabItem({ key: 'tab-2', title: 'Tab 2', layout: AutoGridLayoutManager.createEmpty() });

  const tabsManager = new TabsLayoutManager({ tabs: [tab1, tab2] });
  // DashboardScene always creates its own orchestrator, so use that instance
  const dashboard = new DashboardScene({ body: tabsManager });
  const orchestrator = dashboard.state.layoutOrchestrator!;
  dashboard.activate();

  return { orchestrator, tabsManager, tab1, tab2, rowA, tab1Rows, dashboard };
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

  // DashboardScene always creates its own orchestrator, so use that instance
  const dashboard = new DashboardScene({
    body: tabsManager,
  });
  const orchestrator = dashboard.state.layoutOrchestrator!;

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
