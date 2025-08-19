import { dashboardEditActions } from '../../edit-pane/shared';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

let lastUndo: (() => void) | undefined;

jest.mock('../../edit-pane/shared', () => ({
  dashboardEditActions: {
    addElement: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
    removeElement: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
    moveElement: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
  },
  ObjectsReorderedOnCanvasEvent: jest.fn().mockImplementation(() => ({})),
}));

describe('TabsLayoutManager', () => {
  describe('url sync', () => {
    it('when on top level', () => {
      const tabsLayoutManager = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Performance' })],
      });

      const urlState = tabsLayoutManager.getUrlState();
      expect(urlState).toEqual({ dtab: 'performance' });
    });

    it('when nested under row and parent tab', () => {
      const innerMostTabs = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Performance' })],
      });

      new RowsLayoutManager({
        rows: [
          new RowItem({
            title: 'Overview',
            layout: new TabsLayoutManager({
              tabs: [
                new TabItem({
                  title: 'Frontend',
                  layout: innerMostTabs,
                }),
              ],
            }),
          }),
        ],
      });

      const urlState = innerMostTabs.getUrlState();
      expect(urlState).toEqual({
        ['overview-frontend-dtab']: 'performance',
      });
    });
  });

  describe('addNewTab', () => {
    beforeEach(() => {
      lastUndo = undefined;
    });

    it('should add a new tab with default title when no title is provided', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const newTab = manager.addNewTab();

      expect(newTab).toBeInstanceOf(TabItem);
      expect(newTab.state.title).toBe('New tab');
      expect(manager.state.tabs).toHaveLength(1);
      expect(manager.state.tabs[0]).toBe(newTab);
    });

    it('should add a tab with the provided title if it is unique', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const newTab = manager.addNewTab(new TabItem({ title: 'Unique Title' }));

      expect(newTab.state.title).toBe('Unique Title');
      expect(manager.state.tabs).toHaveLength(1);
      expect(manager.state.tabs[0]).toBe(newTab);
    });

    it('should generate a unique title when adding a tab with a duplicate title', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const firstTab = manager.addNewTab(new TabItem({ title: 'Test Title' }));
      const secondTab = manager.addNewTab(new TabItem({ title: 'Test Title' }));

      expect(firstTab.state.title).toBe('Test Title');
      expect(secondTab.state.title).toBe('Test Title 1');
      expect(manager.state.tabs).toHaveLength(2);
    });

    it('should increment the number in the title for multiple duplicates', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const firstTab = manager.addNewTab(new TabItem({ title: 'Test Title' }));
      const secondTab = manager.addNewTab(new TabItem({ title: 'Test Title' }));
      const thirdTab = manager.addNewTab(new TabItem({ title: 'Test Title' }));

      expect(firstTab.state.title).toBe('Test Title');
      expect(secondTab.state.title).toBe('Test Title 1');
      expect(thirdTab.state.title).toBe('Test Title 2');
      expect(manager.state.tabs).toHaveLength(3);
    });

    it('should handle undo action correctly', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      manager.addNewTab(new TabItem({ title: 'Test Title' }));

      expect(manager.state.tabs).toHaveLength(1);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo && lastUndo();

      expect(manager.state.tabs).toHaveLength(0);
    });
  });

  describe('removeTab', () => {
    beforeEach(() => {
      lastUndo = undefined;
    });

    it('should remove a non-current tab without using removeElement', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const tab1 = manager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = manager.addNewTab(new TabItem({ title: 'Tab 2' }));

      expect(manager.state.tabs).toHaveLength(2);
      expect(manager.state.currentTabIndex).toBe(1); // tab2 is current

      manager.removeTab(tab1);

      expect(manager.state.tabs).toHaveLength(1);
      expect(manager.state.tabs[0]).toBe(tab2);
      expect(manager.state.currentTabIndex).toBe(0);
      expect(dashboardEditActions.removeElement).not.toHaveBeenCalled();
    });

    it('should remove the current tab using removeElement', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const tab1 = manager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = manager.addNewTab(new TabItem({ title: 'Tab 2' }));

      expect(manager.state.tabs).toHaveLength(2);
      expect(manager.state.currentTabIndex).toBe(1); // tab2 is current

      manager.removeTab(tab2);

      expect(manager.state.tabs).toHaveLength(1);
      expect(manager.state.tabs[0]).toBe(tab1);
      expect(manager.state.currentTabIndex).toBe(0);
      expect(dashboardEditActions.removeElement).toHaveBeenCalled();
    });

    it('should handle undo action correctly when removing the current tab', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const tab1 = manager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = manager.addNewTab(new TabItem({ title: 'Tab 2' }));

      expect(manager.state.tabs).toHaveLength(2);
      expect(manager.state.currentTabIndex).toBe(1); // tab2 is current

      manager.removeTab(tab2);

      expect(manager.state.tabs).toHaveLength(1);
      expect(manager.state.tabs[0]).toBe(tab1);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo && lastUndo();

      expect(manager.state.tabs).toHaveLength(2);
      expect(manager.state.tabs).toContain(tab1);
      expect(manager.state.tabs).toContain(tab2);
      expect(manager.state.currentTabIndex).toBe(1); // tab2 should be current again
    });
  });

  describe('moveTab', () => {
    beforeEach(() => {
      lastUndo = undefined;
      jest.clearAllMocks();
    });

    it('should move a tab to a new position', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const tab1 = manager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = manager.addNewTab(new TabItem({ title: 'Tab 2' }));
      const tab3 = manager.addNewTab(new TabItem({ title: 'Tab 3' }));

      expect(manager.state.tabs).toEqual([tab1, tab2, tab3]);

      manager.moveTab(0, 2);

      expect(manager.state.tabs).toEqual([tab2, tab3, tab1]);
      expect(dashboardEditActions.moveElement).toHaveBeenCalled();
    });

    it('should handle undo action correctly when moving a tab', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const tab1 = manager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = manager.addNewTab(new TabItem({ title: 'Tab 2' }));
      const tab3 = manager.addNewTab(new TabItem({ title: 'Tab 3' }));

      expect(manager.state.tabs).toEqual([tab1, tab2, tab3]);

      manager.moveTab(0, 2);

      expect(manager.state.tabs).toEqual([tab2, tab3, tab1]);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo && lastUndo();

      expect(manager.state.tabs).toEqual([tab1, tab2, tab3]);
    });

    it('should update currentTabIndex when moving the current tab', () => {
      const manager = new TabsLayoutManager({ tabs: [] });
      const tab1 = manager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = manager.addNewTab(new TabItem({ title: 'Tab 2' }));
      const tab3 = manager.addNewTab(new TabItem({ title: 'Tab 3' }));

      // Set tab2 as current
      manager.setState({ currentTabIndex: 1 });
      expect(manager.state.currentTabIndex).toBe(1);

      manager.moveTab(1, 0);

      expect(manager.state.tabs).toEqual([tab2, tab1, tab3]);
      expect(manager.state.currentTabIndex).toBe(0);

      // Undo should restore the original state
      lastUndo && lastUndo();

      expect(manager.state.tabs).toEqual([tab1, tab2, tab3]);
      expect(manager.state.currentTabIndex).toBe(1);
    });
  });
});
