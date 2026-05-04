import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { addNewRowTo, addNewTabTo, pasteRowTo, pasteTabTo } from './addNew';

jest.mock('../../edit-pane/shared', () => ({
  dashboardEditActions: {
    addElement: jest.fn(({ perform }) => {
      perform();
    }),
    removeElement: jest.fn(({ perform }) => {
      perform();
    }),
    edit: jest.fn(({ perform }) => {
      perform();
    }),
  },
  NewObjectAddedToCanvasEvent: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('./paste', () => ({
  getRowFromClipboard: jest.fn(() => new RowItem({ title: 'Pasted Row' })),
  getTabFromClipboard: jest.fn(() => new TabItem({ title: 'Pasted Tab' })),
}));

function buildScene(body: DashboardScene['state']['body']) {
  return new DashboardScene({ body });
}

describe('addNewTabTo', () => {
  describe('when layout has no tabs', () => {
    it('should wrap existing content into a single tab', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      const grid = DefaultGridLayoutManager.fromVizPanels([panel]);
      buildScene(grid);

      addNewTabTo(grid);

      const newBody = (grid.parent as DashboardScene).state.body;
      expect(newBody).toBeInstanceOf(TabsLayoutManager);

      const tabs = (newBody as TabsLayoutManager).state.tabs;
      expect(tabs).toHaveLength(1);
      expect(tabs[0].getLayout().getVizPanels()).toHaveLength(1);
    });
  });

  describe('when layout already has tabs', () => {
    it('should add one empty tab', () => {
      const tabsLayout = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Existing Tab' })],
      });
      buildScene(tabsLayout);

      addNewTabTo(tabsLayout);

      expect(tabsLayout.state.tabs).toHaveLength(2);
      expect(tabsLayout.state.tabs[0].state.title).toBe('Existing Tab');
      expect(tabsLayout.state.tabs[1].getLayout().getVizPanels()).toHaveLength(0);
    });
  });

  describe('when layout is inside a RowItem with no tabs', () => {
    it('should wrap the row inner layout into a single tab', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      const innerGrid = DefaultGridLayoutManager.fromVizPanels([panel]);
      const row = new RowItem({ title: 'Row 1', layout: innerGrid });
      const rowsLayout = new RowsLayoutManager({ rows: [row] });
      buildScene(rowsLayout);

      addNewTabTo(innerGrid);

      const newInnerLayout = row.getLayout();
      expect(newInnerLayout).toBeInstanceOf(TabsLayoutManager);

      const tabs = (newInnerLayout as TabsLayoutManager).state.tabs;
      expect(tabs).toHaveLength(1);
      expect(tabs[0].getLayout().getVizPanels()).toHaveLength(1);
    });
  });

  describe('when layout is TabsLayoutManager inside a RowItem', () => {
    it('should add one empty tab to that TabsLayoutManager', () => {
      const innerTabs = new TabsLayoutManager({
        tabs: [new TabItem({ title: 'Tab A' }), new TabItem({ title: 'Tab B' })],
      });
      const row = new RowItem({ title: 'Row 1', layout: innerTabs });
      const rowsLayout = new RowsLayoutManager({ rows: [row] });
      buildScene(rowsLayout);

      addNewTabTo(innerTabs);

      expect(innerTabs.state.tabs).toHaveLength(3);
      expect(innerTabs.state.tabs[2].getLayout().getVizPanels()).toHaveLength(0);
    });
  });
});

describe('addNewRowTo', () => {
  let originalDashboardNewLayouts: boolean | undefined;

  beforeAll(() => {
    originalDashboardNewLayouts = config.featureToggles.dashboardNewLayouts;
    config.featureToggles.dashboardNewLayouts = true;
  });

  afterAll(() => {
    config.featureToggles.dashboardNewLayouts = originalDashboardNewLayouts;
  });

  describe('when layout has no rows', () => {
    it('should wrap existing content into a single row', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      const grid = DefaultGridLayoutManager.fromVizPanels([panel]);
      buildScene(grid);

      addNewRowTo(grid);

      const newBody = (grid.parent as DashboardScene).state.body;
      expect(newBody).toBeInstanceOf(RowsLayoutManager);

      const rows = (newBody as RowsLayoutManager).state.rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].getLayout().getVizPanels()).toHaveLength(1);
    });
  });

  describe('when layout already has rows', () => {
    it('should add one empty row', () => {
      const rowsLayout = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Existing Row' })],
      });
      buildScene(rowsLayout);

      addNewRowTo(rowsLayout);

      expect(rowsLayout.state.rows).toHaveLength(2);
      expect(rowsLayout.state.rows[0].state.title).toBe('Existing Row');
      expect(rowsLayout.state.rows[1].getLayout().getVizPanels()).toHaveLength(0);
    });
  });

  describe('when layout is a TabsLayoutManager (recurse into current tab)', () => {
    it('should wrap current tab inner layout into a single row when tab has no rows', () => {
      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      const innerGrid = DefaultGridLayoutManager.fromVizPanels([panel]);
      const tab = new TabItem({ title: 'Tab 1', layout: innerGrid });
      const tabsLayout = new TabsLayoutManager({ tabs: [tab] });
      tabsLayout.setState({ currentTabSlug: tab.getSlug() });
      buildScene(tabsLayout);

      addNewRowTo(tabsLayout);

      const tabLayout = tab.getLayout();
      expect(tabLayout).toBeInstanceOf(RowsLayoutManager);

      const rows = (tabLayout as RowsLayoutManager).state.rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].getLayout().getVizPanels()).toHaveLength(1);
    });

    it('should add one empty row when current tab already has rows', () => {
      const innerRows = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Row A' })],
      });
      const tab = new TabItem({ title: 'Tab 1', layout: innerRows });
      const tabsLayout = new TabsLayoutManager({ tabs: [tab] });
      tabsLayout.setState({ currentTabSlug: tab.getSlug() });
      buildScene(tabsLayout);

      addNewRowTo(tabsLayout);

      expect(innerRows.state.rows).toHaveLength(2);
      expect(innerRows.state.rows[0].state.title).toBe('Row A');
      expect(innerRows.state.rows[1].getLayout().getVizPanels()).toHaveLength(0);
    });
  });
});

describe('pasteRowTo', () => {
  let originalDashboardNewLayouts: boolean | undefined;

  beforeAll(() => {
    originalDashboardNewLayouts = config.featureToggles.dashboardNewLayouts;
    config.featureToggles.dashboardNewLayouts = true;
  });

  afterAll(() => {
    config.featureToggles.dashboardNewLayouts = originalDashboardNewLayouts;
  });

  it('should call pasteRow when layout is already a RowsLayoutManager', () => {
    const rowsLayout = new RowsLayoutManager({
      rows: [new RowItem({ title: 'Existing Row' })],
    });
    buildScene(rowsLayout);

    rowsLayout.pasteRow = jest.fn();
    pasteRowTo(rowsLayout);

    expect(rowsLayout.pasteRow).toHaveBeenCalled();
  });

  it('should replace layout with a RowsLayoutManager containing only the pasted row when layout is a plain grid', () => {
    const grid = DefaultGridLayoutManager.fromVizPanels([]);
    buildScene(grid);

    pasteRowTo(grid);

    const newBody = (grid.parent as DashboardScene).state.body;
    expect(newBody).toBeInstanceOf(RowsLayoutManager);

    const rows = (newBody as RowsLayoutManager).state.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].state.title).toBe('Pasted Row');
  });

  it('should recurse into the current tab when layout is a TabsLayoutManager', () => {
    const innerGrid = DefaultGridLayoutManager.fromVizPanels([]);
    const tab = new TabItem({ title: 'Tab 1', layout: innerGrid });
    const tabsLayout = new TabsLayoutManager({ tabs: [tab] });
    tabsLayout.setState({ currentTabSlug: tab.getSlug() });
    buildScene(tabsLayout);

    pasteRowTo(tabsLayout);

    // The tab's inner layout should have been replaced with a RowsLayoutManager
    const tabLayout = tab.getLayout();
    expect(tabLayout).toBeInstanceOf(RowsLayoutManager);

    const rows = (tabLayout as RowsLayoutManager).state.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].state.title).toBe('Pasted Row');
  });
});

describe('pasteTabTo', () => {
  it('should call pasteTab when layout is already a TabsLayoutManager', () => {
    const tabsLayout = new TabsLayoutManager({
      tabs: [new TabItem({ title: 'Existing Tab' })],
    });
    buildScene(tabsLayout);

    tabsLayout.pasteTab = jest.fn();
    pasteTabTo(tabsLayout);

    expect(tabsLayout.pasteTab).toHaveBeenCalled();
  });

  it('should replace layout with a TabsLayoutManager containing only the pasted tab when layout is a plain grid', () => {
    const grid = DefaultGridLayoutManager.fromVizPanels([]);
    buildScene(grid);

    pasteTabTo(grid);

    const newBody = (grid.parent as DashboardScene).state.body;
    expect(newBody).toBeInstanceOf(TabsLayoutManager);

    const tabs = (newBody as TabsLayoutManager).state.tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].state.title).toBe('Pasted Tab');
  });
});
