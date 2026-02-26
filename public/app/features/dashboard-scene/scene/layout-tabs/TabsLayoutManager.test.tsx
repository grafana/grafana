import { VizPanel } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
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
    edit: jest.fn(({ perform }) => {
      perform();
    }),
  },
  ObjectsReorderedOnCanvasEvent: jest.fn().mockImplementation(() => ({})),
}));

function buildTabsLayoutManager(tabs: TabItem[]) {
  const tabsLayoutManager = new TabsLayoutManager({ tabs });
  new DashboardScene({ body: tabsLayoutManager });
  return tabsLayoutManager;
}

describe('TabsLayoutManager', () => {
  describe('URL sync', () => {
    it('when on top level', () => {
      const tabsLayoutManager = buildTabsLayoutManager([new TabItem({ title: 'Performance' })]);

      // currentTabSlug is set during rendering so forcing here
      tabsLayoutManager.setState({ currentTabSlug: tabsLayoutManager.getCurrentTab()?.getSlug() });

      const urlState = tabsLayoutManager.getUrlState();
      expect(urlState).toEqual({ dtab: 'performance' });
    });

    it('when nested under row and parent tab', () => {
      const innerMostTabsLayoutManager = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Performance' })],
      });

      // currentTabSlug is set during rendering so forcing here
      innerMostTabsLayoutManager.setState({ currentTabSlug: innerMostTabsLayoutManager.getCurrentTab()?.getSlug() });

      new RowsLayoutManager({
        rows: [
          new RowItem({
            title: 'Overview',
            layout: new TabsLayoutManager({
              tabs: [new TabItem({ title: 'Frontend', layout: innerMostTabsLayoutManager })],
            }),
          }),
        ],
      });

      const urlState = innerMostTabsLayoutManager.getUrlState();
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
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const newTab = tabsLayoutManager.addNewTab();

      expect(newTab).toBeInstanceOf(TabItem);
      expect(newTab.state.title).toBe('New tab');
      expect(tabsLayoutManager.state.tabs).toHaveLength(1);
      expect(tabsLayoutManager.state.tabs[0]).toBe(newTab);
      expect(tabsLayoutManager.state.currentTabSlug).toBe(newTab.getSlug());
    });

    it('should add a tab with the provided title if it is unique', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const newTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Unique Title' }));

      expect(newTab.state.title).toBe('Unique Title');
      expect(tabsLayoutManager.state.tabs).toHaveLength(1);
      expect(tabsLayoutManager.state.tabs[0]).toBe(newTab);
      expect(tabsLayoutManager.state.currentTabSlug).toBe(newTab.getSlug());
    });

    it('should generate a unique title when adding a tab with a duplicate title', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const firstTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Test Title' }));
      const secondTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Test Title' }));

      expect(tabsLayoutManager.state.tabs).toHaveLength(2);
      expect(firstTab.state.title).toBe('Test Title');
      expect(secondTab.state.title).toBe('Test Title 1');
      expect(tabsLayoutManager.state.currentTabSlug).toBe(secondTab.getSlug());
    });

    it('should increment the number in the title for multiple duplicates', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const firstTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Test Title' }));
      const secondTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Test Title' }));
      const thirdTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Test Title' }));

      expect(tabsLayoutManager.state.tabs).toHaveLength(3);
      expect(firstTab.state.title).toBe('Test Title');
      expect(secondTab.state.title).toBe('Test Title 1');
      expect(thirdTab.state.title).toBe('Test Title 2');
      expect(tabsLayoutManager.state.currentTabSlug).toBe(thirdTab.getSlug());
    });

    it('should handle undo action correctly', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      tabsLayoutManager.addNewTab(new TabItem({ title: 'Test Title' }));

      expect(tabsLayoutManager.state.tabs).toHaveLength(1);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo!();

      expect(tabsLayoutManager.state.tabs).toHaveLength(0);
    });
  });

  describe('removeTab', () => {
    beforeEach(() => {
      lastUndo = undefined;
      jest.clearAllMocks();
    });

    it('should remove a tab and call the removeElement action', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const tab1 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 2' }));
      const tab3 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 3' }));

      tabsLayoutManager.removeTab(tab3);

      expect(tabsLayoutManager.state.tabs).toHaveLength(2);
      expect(tabsLayoutManager.state.tabs[0]).toBe(tab1);
      expect(tabsLayoutManager.state.tabs[1]).toBe(tab2);
      expect(tabsLayoutManager.state.currentTabSlug).toBe(tab2.getSlug());
      expect(dashboardEditActions.removeElement).toHaveBeenCalled();
    });

    it('should handle undo action correctly', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const tab1 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 2' }));

      tabsLayoutManager.removeTab(tab2);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo!();

      expect(tabsLayoutManager.state.tabs).toHaveLength(2);
      expect(tabsLayoutManager.state.tabs[0]).toBe(tab1);
      expect(tabsLayoutManager.state.tabs[1]).toBe(tab2);
      expect(tabsLayoutManager.state.currentTabSlug).toBe(tab2.getSlug()); // tab2 should be current again
    });

    describe('when the last tab is removed', () => {
      it('should switch the parent layout to an empty auto grid layout', () => {
        const tabsLayoutManager = buildTabsLayoutManager([]);
        const tab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Only Tab' }));

        tabsLayoutManager.removeTab(tab);

        const parentLayoutManager = (tabsLayoutManager.parent as DashboardScene).state.body;
        expect(parentLayoutManager).toBeInstanceOf(AutoGridLayoutManager);
        expect(parentLayoutManager.getVizPanels()).toHaveLength(0);
      });

      it('should handle undo action correctly', () => {
        const tabsLayoutManager = buildTabsLayoutManager([]);
        const tab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Only Tab' }));
        const parent = tabsLayoutManager.parent as DashboardScene;

        tabsLayoutManager.removeTab(tab);

        expect(typeof lastUndo).toBe('function');
        lastUndo!();

        expect(parent.state.body).toBe(tabsLayoutManager);
        expect(tabsLayoutManager.state.tabs).toHaveLength(1);
        expect(tabsLayoutManager.state.tabs[0]).toBe(tab);
      });
    });
  });

  describe('moveTab', () => {
    beforeEach(() => {
      lastUndo = undefined;
      jest.clearAllMocks();
    });

    it('should move a tab to a new position', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);

      const tab1 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 1' }));
      const tab2 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 2' }));
      const tab3 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 3' }));

      tabsLayoutManager.moveTab(0, 2);

      expect(tabsLayoutManager.state.tabs[0]).toBe(tab2);
      expect(tabsLayoutManager.state.tabs[1]).toBe(tab3);
      expect(tabsLayoutManager.state.tabs[2]).toBe(tab1);
      expect(dashboardEditActions.moveElement).toHaveBeenCalled();
    });

    describe('undo', () => {
      it('should handle undo action correctly', () => {
        const tabsLayoutManager = buildTabsLayoutManager([]);

        const tab1 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 1' }));
        const tab2 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 2' }));
        const tab3 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 3' }));

        tabsLayoutManager.moveTab(0, 2);

        expect(tabsLayoutManager.state.tabs[0]).toBe(tab2);
        expect(tabsLayoutManager.state.tabs[1]).toBe(tab3);
        expect(tabsLayoutManager.state.tabs[2]).toBe(tab1);

        // Use the real undo function from the mock
        expect(typeof lastUndo).toBe('function');
        lastUndo!();

        expect(tabsLayoutManager.state.tabs[0]).toBe(tab1);
        expect(tabsLayoutManager.state.tabs[1]).toBe(tab2);
        expect(tabsLayoutManager.state.tabs[2]).toBe(tab3);
      });

      it('should update currentTabIndex when moving the current tab', () => {
        const tabsLayoutManager = buildTabsLayoutManager([]);

        const tab1 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 1' }));
        const tab2 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 2' }));
        const tab3 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab 3' }));

        // Set tab2 as current
        tabsLayoutManager.setState({ currentTabSlug: tab2.getSlug() });
        tabsLayoutManager.moveTab(1, 0);

        expect(tabsLayoutManager.state.tabs[0]).toBe(tab2);
        expect(tabsLayoutManager.state.tabs[1]).toBe(tab1);
        expect(tabsLayoutManager.state.tabs[2]).toBe(tab3);
        expect(tabsLayoutManager.state.currentTabSlug).toBe(tab2.getSlug());

        // Undo should restore the original state
        expect(typeof lastUndo).toBe('function');
        lastUndo!();

        expect(tabsLayoutManager.state.tabs[0]).toBe(tab1);
        expect(tabsLayoutManager.state.tabs[1]).toBe(tab2);
        expect(tabsLayoutManager.state.tabs[2]).toBe(tab3);
        expect(tabsLayoutManager.state.currentTabSlug).toBe(tab2.getSlug());
      });
    });
  });

  describe('getVizPanels', () => {
    it('Should not included repeated tabs', () => {
      const manager = new TabsLayoutManager({
        tabs: [
          new TabItem({
            title: 'Tab 1',
            layout: DefaultGridLayoutManager.fromVizPanels([new VizPanel({ key: 'panel-1' })]),
            repeatedTabs: [
              new TabItem({
                title: 'Tab 1 - Copy 1',
                layout: DefaultGridLayoutManager.fromVizPanels([new VizPanel({ key: 'panel-1' })]),
              }),
              new TabItem({
                title: 'Tab 1 - Copy 2',
                layout: DefaultGridLayoutManager.fromVizPanels([new VizPanel({ key: 'panel-1' })]),
              }),
            ],
          }),
        ],
      });
      expect(manager.getVizPanels().length).toBe(1);
    });
  });

  describe('createFromLayout', () => {
    it('should convert rows with titles to tabs', () => {
      const rowsLayout = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row 1' }), new RowItem({ title: 'Row 2' })],
      });

      const tabsManager = TabsLayoutManager.createFromLayout(rowsLayout);

      expect(tabsManager.state.tabs).toHaveLength(2);
      expect(tabsManager.state.tabs[0].state.title).toBe('Row 1');
      expect(tabsManager.state.tabs[1].state.title).toBe('Row 2');
    });

    it('should use default title when row has empty title', () => {
      const rowsLayout = new RowsLayoutManager({
        rows: [new RowItem({ title: '' })],
      });

      const tabsManager = TabsLayoutManager.createFromLayout(rowsLayout);

      expect(tabsManager.state.tabs).toHaveLength(1);
      expect(tabsManager.state.tabs[0].state.title).toBe('New tab');
    });

    it('should generate unique titles for multiple rows with empty titles', () => {
      const rowsLayout = new RowsLayoutManager({
        rows: [new RowItem({ title: '' }), new RowItem({ title: '' }), new RowItem({ title: '' })],
      });

      const tabsManager = TabsLayoutManager.createFromLayout(rowsLayout);

      expect(tabsManager.state.tabs).toHaveLength(3);
      expect(tabsManager.state.tabs[0].state.title).toBe('New tab');
      expect(tabsManager.state.tabs[1].state.title).toBe('New tab 1');
      expect(tabsManager.state.tabs[2].state.title).toBe('New tab 2');
    });

    it('should generate unique titles when mixing empty and existing titles', () => {
      const rowsLayout = new RowsLayoutManager({
        rows: [
          new RowItem({ title: 'New row' }), // existing title that matches default
          new RowItem({ title: '' }), // empty, should get unique title
        ],
      });

      const tabsManager = TabsLayoutManager.createFromLayout(rowsLayout);

      expect(tabsManager.state.tabs).toHaveLength(2);
      expect(tabsManager.state.tabs[0].state.title).toBe('New row');
      expect(tabsManager.state.tabs[1].state.title).toBe('New tab');
    });
  });
});
