import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { getLegacySlugForRowOrTab } from '../layouts-shared/utils';

import { TabItem } from './TabItem';
import { getTabsLayoutUrlKeysToTry, TabsLayoutManager } from './TabsLayoutManager';

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

function buildTabsLayoutManager(tabs: TabItem[] = []) {
  const tabsLayoutManager = new TabsLayoutManager({ key: 'test-TabsLayoutManager', tabs });
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
      expect(urlState).toEqual({ dtab: 'Performance' });
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
        ['Overview-Frontend-dtab']: 'Performance',
      });
    });
  });

  describe('getSlug', () => {
    it('generates slugs based on tab titles', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const tab1 = tabsLayoutManager.addNewTab(new TabItem({ title: 'My Tab Title' }));
      const tab2 = tabsLayoutManager.addNewTab(new TabItem({ title: 'Another Tab!' }));

      expect(tab1.getSlug()).toBe('My-Tab-Title');
      expect(tab2.getSlug()).toBe('Another-Tab!');
    });

    it('disambiguates slugs when multiple titles are encoded to the same value', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const firstTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'New tab 1' }));
      const secondTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'New tab-1' }));

      expect(firstTab.getSlug()).toBe('New-tab-1');
      expect(secondTab.getSlug()).toBe('New-tab-1__2');
    });

    it('keeps clean slugs when there is no slug duplication', () => {
      const tabsLayoutManager = buildTabsLayoutManager([]);
      const firstTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab One' }));
      const secondTab = tabsLayoutManager.addNewTab(new TabItem({ title: 'Tab Two' }));

      expect(firstTab.getSlug()).toBe('Tab-One');
      expect(secondTab.getSlug()).toBe('Tab-Two');
    });

    it('keeps slug values stable across different tab layout instances', () => {
      const titles = ['New tab 1', 'New tab-1', 'Other tab'];

      const getSlugsFromFreshLayout = () => {
        const tabs = titles.map((title) => new TabItem({ title }));
        buildTabsLayoutManager(tabs);
        return tabs.map((tab) => tab.getSlug());
      };

      const firstRunSlugs = getSlugsFromFreshLayout();
      const secondRunSlugs = getSlugsFromFreshLayout();

      expect(firstRunSlugs).toEqual(['New-tab-1', 'New-tab-1__2', 'Other-tab']);
      expect(secondRunSlugs).toEqual(firstRunSlugs);
    });

    it('skips empty primary query value and falls back to legacy slugified key', () => {
      const tab1 = new TabItem({ title: 'question?' });
      const tab2 = new TabItem({ title: 'Performance' });
      const [tabManager, urlKeys] = setupRowWithTabs([tab1, tab2]);

      const updateFromUrlArgs = {
        [urlKeys[0]]: '',
        [urlKeys[1]]: getLegacySlugForRowOrTab(tab2),
      };

      assertSelectedTab(tabManager, updateFromUrlArgs, {
        slug: getLegacySlugForRowOrTab(tab2),
        title: tab2.state.title!,
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

  describe('mapTabInsertIndex', () => {
    it('maps indices correctly with no repeated tabs', () => {
      const a = new TabItem({ title: 'A' });
      const b = new TabItem({ title: 'B' });
      const c = new TabItem({ title: 'C' });
      const manager = new TabsLayoutManager({ tabs: [a, b, c] });

      // allTabs: [A, B, C]
      expect(manager.mapTabInsertIndex(-5)).toBe(0); // clamped to 0 -> before A
      expect(manager.mapTabInsertIndex(0)).toBe(0); // before A
      expect(manager.mapTabInsertIndex(1)).toBe(1); // between A|B -> after A
      expect(manager.mapTabInsertIndex(2)).toBe(2); // between B|C -> after B
      expect(manager.mapTabInsertIndex(3)).toBe(3); // after C
      expect(manager.mapTabInsertIndex(99)).toBe(3); // clamped to length -> after C
    });

    it('maps before, inside, and after a repeated group', () => {
      const a = new TabItem({ title: 'A' });
      const b = new TabItem({ title: 'B' });
      const c = new TabItem({ title: 'C' });

      // A has two repeats -> A group occupies indices [0,1,2] in allTabs
      const aClone1 = new TabItem({ title: 'A1', repeatSourceKey: a.state.key });
      const aClone2 = new TabItem({ title: 'A2', repeatSourceKey: a.state.key });
      a.setState({ repeatedTabs: [aClone1, aClone2] });

      const manager = new TabsLayoutManager({ tabs: [a, b, c] });

      // allTabs: [A, A1, A2, B, C]
      expect(manager.mapTabInsertIndex(0)).toBe(0); // before A group -> before A
      expect(manager.mapTabInsertIndex(1)).toBe(1); // inside A group -> after A
      expect(manager.mapTabInsertIndex(2)).toBe(1); // inside A group -> after A
      expect(manager.mapTabInsertIndex(3)).toBe(1); // boundary after A group -> before B (index 1)
      expect(manager.mapTabInsertIndex(4)).toBe(2); // between B|C -> after B
      expect(manager.mapTabInsertIndex(5)).toBe(3); // after C -> at end
    });

    it('handles multiple repeated groups correctly', () => {
      const a = new TabItem({ title: 'A' });
      const b = new TabItem({ title: 'B' });
      const c = new TabItem({ title: 'C' });

      // A x3 total
      const aClone1 = new TabItem({ title: 'A1', repeatSourceKey: a.state.key });
      const aClone2 = new TabItem({ title: 'A2', repeatSourceKey: a.state.key });
      a.setState({ repeatedTabs: [aClone1, aClone2] });

      // B x2 total
      const bClone1 = new TabItem({ title: 'B1', repeatSourceKey: b.state.key });
      b.setState({ repeatedTabs: [bClone1] });

      const manager = new TabsLayoutManager({ tabs: [a, b, c] });

      // allTabs: [A, A1, A2, B, B1, C]
      expect(manager.mapTabInsertIndex(0)).toBe(0); // before A group
      expect(manager.mapTabInsertIndex(2)).toBe(1); // inside A group -> after A
      expect(manager.mapTabInsertIndex(3)).toBe(1); // before B group -> before B (index 1)
      expect(manager.mapTabInsertIndex(4)).toBe(2); // inside B group -> after B (index 2)
      expect(manager.mapTabInsertIndex(5)).toBe(2); // before C -> index 2
      expect(manager.mapTabInsertIndex(6)).toBe(3); // after C -> end
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

  describe('duplicate', () => {
    it('should return a new TabsLayoutManager instance', () => {
      const tabsLayoutManager = buildTabsLayoutManager();

      const duplicated = tabsLayoutManager.duplicate() as TabsLayoutManager;

      expect(duplicated).toBeInstanceOf(TabsLayoutManager);
      expect(duplicated).not.toBe(tabsLayoutManager);
      expect(duplicated.state.key).not.toBe(tabsLayoutManager.state.key);
    });

    it('should duplicate each tab', () => {
      const tabs = [new TabItem({ title: 'Tab 1' }), new TabItem({ title: 'Tab 2' }), new TabItem({ title: 'Tab 3' })];
      const tabDuplicateSpies = tabs.map((row) => jest.spyOn(row, 'duplicate'));
      const tabsLayoutManager = buildTabsLayoutManager(tabs);

      const duplicated = tabsLayoutManager.duplicate() as TabsLayoutManager;

      expect(tabDuplicateSpies[0]).toHaveBeenCalledTimes(1);
      expect(tabDuplicateSpies[1]).toHaveBeenCalledTimes(1);
      expect(tabDuplicateSpies[2]).toHaveBeenCalledTimes(1);

      expect(duplicated.state.tabs.length).toBe(3);
      expect(duplicated.state.tabs[0]).not.toBe(tabs[0]);
      expect(duplicated.state.tabs[1]).not.toBe(tabs[1]);
      expect(duplicated.state.tabs[2]).not.toBe(tabs[2]);
    });

    describe('when tabs contain panels', () => {
      it('should assign unique panel keys across all tabs, starting after the highest existing id', () => {
        const tabsLayoutManager = buildTabsLayoutManager([
          new TabItem({
            title: 'Tab 1',
            layout: new DefaultGridLayoutManager({
              grid: new SceneGridLayout({
                children: [
                  new DashboardGridItem({
                    body: new VizPanel({ key: 'panel-1', title: 'Panel A' }),
                  }),
                  new DashboardGridItem({
                    body: new VizPanel({ key: 'panel-2', title: 'Panel B' }),
                  }),
                ],
              }),
            }),
          }),
          new TabItem({
            title: 'Tab 2',
            layout: new DefaultGridLayoutManager({
              grid: new SceneGridLayout({
                children: [
                  new DashboardGridItem({
                    body: new VizPanel({ key: 'panel-3', title: 'Panel C', pluginId: 'table' }),
                  }),
                  new DashboardGridItem({
                    body: new VizPanel({ key: 'panel-4', title: 'Panel D', pluginId: 'table' }),
                  }),
                ],
              }),
            }),
          }),
        ]);

        const duplicated = tabsLayoutManager.duplicate();

        const panelKeys = duplicated.getVizPanels().map((p) => p.state.key);
        expect(panelKeys).toEqual(['panel-5', 'panel-6', 'panel-7', 'panel-8']);
      });
    });
  });
});

function setupRowWithTabs(tabs: TabItem[]): [TabsLayoutManager, string[]] {
  const tabManager = new TabsLayoutManager({
    tabs: [...tabs],
  });
  new RowsLayoutManager({
    rows: [
      new RowItem({
        title: 'UPPER row!',
        layout: tabManager,
      }),
    ],
  });

  const possibleKeys = getTabsLayoutUrlKeysToTry(tabManager);
  expect(possibleKeys).toEqual(['UPPER-row!-dtab', 'upper-row-dtab']);

  return [tabManager, possibleKeys];
}

function assertSelectedTab(
  manager: TabsLayoutManager,
  updateFromUrlValues: Record<string, string>,
  { slug, title }: { slug: string; title: string }
) {
  manager.setState({ currentTabSlug: undefined });
  manager.updateFromUrl(updateFromUrlValues);

  expect(manager.state.currentTabSlug).toBe(slug);
  expect(manager.getCurrentTab()?.state.title).toBe(title);
}
