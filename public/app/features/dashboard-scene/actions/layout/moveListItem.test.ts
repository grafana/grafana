import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { groupRowIntoTab, moveListItem } from './moveListItem';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const titles = (list: RowsLayoutManager | TabsLayoutManager) =>
  list instanceof RowsLayoutManager
    ? list.state.rows.map((row) => row.state.title)
    : list.state.tabs.map((tab) => tab.state.title);

function buildRowsScene() {
  const rows = ['A', 'B', 'C'].map((title) => new RowItem({ key: `row-${title}`, title }));
  const source = new RowsLayoutManager({ key: 'rows-1', rows });
  const destination = new RowsLayoutManager({ key: 'rows-2', rows: [new RowItem({ key: 'row-X', title: 'X' })] });
  const tabs = new TabsLayoutManager({
    tabs: [
      new TabItem({ key: 'tab-1', title: 'Tab 1', layout: source }),
      new TabItem({ key: 'tab-2', title: 'Tab 2', layout: destination }),
    ],
  });
  const dashboard = new DashboardScene({ isEditing: true, body: tabs });
  return { dashboard, source, destination, rows, tabs };
}

describe('moveListItem', () => {
  let deactivate: (() => void) | undefined;

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
  });

  describe('within the same list', () => {
    it('reorders rows and undo restores the order', () => {
      const { dashboard, source, rows } = buildRowsScene();
      deactivate = activateFullSceneTree(dashboard);

      moveListItem({ item: rows[0], source, destination: source, index: 2 });
      expect(titles(source)).toEqual(['B', 'C', 'A']);

      dashboard.state.sidebar.undoAction();
      expect(titles(source)).toEqual(['A', 'B', 'C']);

      dashboard.state.sidebar.redoAction();
      expect(titles(source)).toEqual(['B', 'C', 'A']);
    });

    it('does not add an undo entry when the item stays where it was', () => {
      const { dashboard, source, rows } = buildRowsScene();
      deactivate = activateFullSceneTree(dashboard);

      moveListItem({ item: rows[1], source, destination: source, index: 1 });

      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });
  });

  describe('between lists', () => {
    it('moves a row into another rows layout at the given index, undo moves it back', () => {
      const { dashboard, source, destination, rows } = buildRowsScene();
      deactivate = activateFullSceneTree(dashboard);

      moveListItem({ item: rows[1], source, destination, index: 0 });
      expect(titles(source)).toEqual(['A', 'C']);
      expect(titles(destination)).toEqual(['B', 'X']);
      expect(rows[1].parent).toBe(destination);

      dashboard.state.sidebar.undoAction();
      expect(titles(source)).toEqual(['A', 'B', 'C']);
      expect(titles(destination)).toEqual(['X']);
      expect(rows[1].parent).toBe(source);
    });

    it('makes the title unique in the destination and restores it on undo', () => {
      const { dashboard, source, destination, rows } = buildRowsScene();
      deactivate = activateFullSceneTree(dashboard);
      destination.state.rows[0].setState({ title: 'A' });

      moveListItem({ item: rows[0], source, destination, index: 1 });
      expect(rows[0].state.title).not.toBe('A');

      dashboard.state.sidebar.undoAction();
      expect(rows[0].state.title).toBe('A');
    });

    it('replaces an emptied source with an empty grid and brings it back on undo', () => {
      const row = new RowItem({ key: 'only-row', title: 'Only' });
      const source = new RowsLayoutManager({ rows: [row] });
      const destination = new RowsLayoutManager({ rows: [new RowItem({ title: 'X' })] });
      const sourceTab = new TabItem({ key: 'tab-1', title: 'Tab 1', layout: source });
      const dashboard = new DashboardScene({
        isEditing: true,
        body: new TabsLayoutManager({ tabs: [sourceTab, new TabItem({ title: 'Tab 2', layout: destination })] }),
      });
      deactivate = activateFullSceneTree(dashboard);

      moveListItem({ item: row, source, destination, index: 1 });
      expect(sourceTab.state.layout).toBeInstanceOf(AutoGridLayoutManager);
      expect(titles(destination)).toEqual(['X', 'Only']);

      dashboard.state.sidebar.undoAction();
      expect(sourceTab.state.layout).toBe(source);
      expect(titles(source)).toEqual(['Only']);
      expect(row.parent).toBe(source);
    });

    it('moves a tab into another tab group and makes it the active tab there', () => {
      const moved = new TabItem({ key: 'tab-b', title: 'B' });
      const source = new TabsLayoutManager({ tabs: [new TabItem({ title: 'A' }), moved] });
      const destination = new TabsLayoutManager({ tabs: [new TabItem({ title: 'X' })] });
      const dashboard = new DashboardScene({
        isEditing: true,
        body: new RowsLayoutManager({
          rows: [new RowItem({ title: 'Row 1', layout: source }), new RowItem({ title: 'Row 2', layout: destination })],
        }),
      });
      deactivate = activateFullSceneTree(dashboard);
      source.setState({ currentTabSlug: moved.getSlug() });

      moveListItem({ item: moved, source, destination, index: 1 });
      expect(titles(source)).toEqual(['A']);
      expect(titles(destination)).toEqual(['X', 'B']);
      expect(destination.state.currentTabSlug).toBe(moved.getSlug());
      expect(source.state.currentTabSlug).toBe(source.state.tabs[0].getSlug());

      dashboard.state.sidebar.undoAction();
      expect(titles(source)).toEqual(['A', 'B']);
      expect(source.state.currentTabSlug).toBe(moved.getSlug());
    });
  });

  describe('grouping a tab into rows', () => {
    function buildGroupScene(withPanel: boolean) {
      const panel = new VizPanel({ key: 'panel-1', title: 'Panel', pluginId: 'table' });
      const tabLayout = new AutoGridLayoutManager({
        layout: new AutoGridLayout({ children: withPanel ? [new AutoGridItem({ key: 'item-1', body: panel })] : [] }),
      });
      const row = new RowItem({ key: 'row-moved', title: 'Moved' });
      const source = new RowsLayoutManager({ rows: [row, new RowItem({ title: 'Stays' })] });
      const target = new TabItem({ key: 'tab-2', title: 'Tab 2', layout: tabLayout });
      const tabs = new TabsLayoutManager({
        tabs: [new TabItem({ key: 'tab-1', title: 'Tab 1', layout: source }), target],
      });
      const dashboard = new DashboardScene({ isEditing: true, body: tabs });
      return { dashboard, source, row, target, tabLayout, panel, tabs };
    }

    it('wraps the existing content in a row next to the dropped row, without recreating it', () => {
      const { dashboard, source, row, target, tabLayout, panel } = buildGroupScene(true);
      deactivate = activateFullSceneTree(dashboard);

      groupRowIntoTab({ row, source, tab: target });

      const rows = target.state.layout;
      expect(rows).toBeInstanceOf(RowsLayoutManager);
      expect(titles(rows as RowsLayoutManager)).toEqual(['New row', 'Moved']);
      expect((rows as RowsLayoutManager).state.rows[0].state.layout).toBe(tabLayout);
      expect(panel.parent?.parent?.parent).toBe(tabLayout);
      expect(titles(source)).toEqual(['Stays']);
    });

    it('undo puts back the same layout object and the row in its source, redo groups again', () => {
      const { dashboard, source, row, target, tabLayout, panel } = buildGroupScene(true);
      deactivate = activateFullSceneTree(dashboard);
      groupRowIntoTab({ row, source, tab: target });

      dashboard.state.sidebar.undoAction();
      expect(target.state.layout).toBe(tabLayout);
      expect(tabLayout.parent).toBe(target);
      expect(panel.parent?.parent?.parent).toBe(tabLayout);
      expect(titles(source)).toEqual(['Moved', 'Stays']);
      expect(row.parent).toBe(source);

      dashboard.state.sidebar.redoAction();
      expect(titles(target.state.layout as RowsLayoutManager)).toEqual(['New row', 'Moved']);
      expect((target.state.layout as RowsLayoutManager).state.rows[0].state.layout).toBe(tabLayout);
    });

    it('drops the row alone into an empty tab, undo restores the empty layout', () => {
      const { dashboard, source, row, target, tabLayout } = buildGroupScene(false);
      deactivate = activateFullSceneTree(dashboard);

      groupRowIntoTab({ row, source, tab: target });
      expect(titles(target.state.layout as RowsLayoutManager)).toEqual(['Moved']);

      dashboard.state.sidebar.undoAction();
      expect(target.state.layout).toBe(tabLayout);
    });

    it('makes the grouped tab the active one and restores the previous active tab on undo', () => {
      const { dashboard, source, row, target, tabs } = buildGroupScene(true);
      deactivate = activateFullSceneTree(dashboard);
      const prevSlug = tabs.state.currentTabSlug;

      groupRowIntoTab({ row, source, tab: target });
      expect(tabs.state.currentTabSlug).toBe(target.getSlug());

      dashboard.state.sidebar.undoAction();
      expect(tabs.state.currentTabSlug).toBe(prevSlug);
    });
  });
});
