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

import { groupRowIntoTab } from './groupRowIntoTab';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('groupRowIntoTab', () => {
  let deactivate: () => void;
  afterEach(() => deactivate?.());

  it('puts the same layout object back in the tab on undo and reuses the new rows on redo', () => {
    const { row, source, sourceTab, tab, tabs, gridLayout, sidebar } = setup('Row');

    groupRowIntoTab({ row, source, tab });
    const rows = tab.getLayout() as RowsLayoutManager;
    expect(rows.state.rows.map((item) => item.state.title)).toEqual(['New row', 'Row']);
    expect(rows.state.rows[0].getLayout()).toBe(gridLayout);
    expect(tabs.getCurrentTab()).toBe(tab);
    // The source lost its only row
    expect(sourceTab.getLayout()).toBeInstanceOf(AutoGridLayoutManager);

    sidebar.undoAction();
    expect(tab.getLayout()).toBe(gridLayout);
    expect(gridLayout.parent).toBe(tab);
    expect(sourceTab.getLayout()).toBe(source);
    expect(row.parent).toBe(source);
    expect(tabs.getCurrentTab()).toBe(sourceTab);

    sidebar.redoAction();
    expect(tab.getLayout()).toBe(rows);
    expect(rows.state.rows[0].getLayout()).toBe(gridLayout);
    expect(rows.state.rows[1]).toBe(row);
  });

  it('renames the row when it has the title of the new row, and restores the title on undo', () => {
    const { row, source, tab, sidebar } = setup('New row');

    groupRowIntoTab({ row, source, tab });
    expect(row.state.title).toBe('New row 1');

    sidebar.undoAction();
    expect(row.state.title).toBe('New row');
  });

  function setup(rowTitle: string) {
    const row = new RowItem({ title: rowTitle });
    const source = new RowsLayoutManager({ rows: [row] });
    const sourceTab = new TabItem({ title: 'Source', layout: source });
    const gridLayout = new AutoGridLayoutManager({
      layout: new AutoGridLayout({
        children: [new AutoGridItem({ body: new VizPanel({ title: 'Panel', pluginId: 'table' }) })],
      }),
    });
    const tab = new TabItem({ title: 'Grid', layout: gridLayout });
    const tabs = new TabsLayoutManager({ tabs: [sourceTab, tab], currentTabSlug: sourceTab.getSlug() });
    const dashboard = new DashboardScene({ isEditing: true, body: tabs });
    deactivate = activateFullSceneTree(dashboard);
    return { row, source, sourceTab, tab, tabs, gridLayout, sidebar: dashboard.state.sidebar };
  }
});
