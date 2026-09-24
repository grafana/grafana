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

import { moveRowToTab } from './moveRowToTab';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('moveRowToTab', () => {
  let deactivate: () => void;
  afterEach(() => deactivate?.());

  it('rejects a detached source layout before moving the row', () => {
    const row = new RowItem({ title: 'Row' });
    const source = new RowsLayoutManager({ rows: [row] });
    const target = AutoGridLayoutManager.createEmpty();
    const destination = new TabItem({ layout: target });

    expect(() => moveRowToTab({ row, source, destination })).toThrow('Parent object is not a LayoutParent');
    expect(source.state.rows).toEqual([row]);
    expect(destination.getLayout()).toBe(target);
  });

  it('moves the last source row into an existing rows layout and restores both layouts on undo', () => {
    const row = new RowItem({ title: 'New row', layout: AutoGridLayoutManager.createEmpty() });
    const source = new RowsLayoutManager({ rows: [row] });
    const existingRow = new RowItem({ title: 'Existing row', layout: AutoGridLayoutManager.createEmpty() });
    const previousDestination = new RowsLayoutManager({ rows: [existingRow] });
    const sourceTab = new TabItem({ title: 'Source', layout: source });
    const destination = new TabItem({ title: 'Destination', layout: previousDestination });
    const tabs = new TabsLayoutManager({ tabs: [sourceTab, destination], currentTabSlug: sourceTab.getSlug() });
    const dashboard = new DashboardScene({ isEditing: true, body: tabs });
    deactivate = activateFullSceneTree(dashboard);
    const sidebar = dashboard.state.sidebar;

    moveRowToTab({ row, source, destination });
    const movedLayout = destination.getLayout() as RowsLayoutManager;
    expect(movedLayout).toBe(previousDestination);
    expect(movedLayout.state.rows).toEqual([existingRow, row]);
    expect(movedLayout.parent).toBe(destination);
    expect(row.parent).toBe(movedLayout);
    expect(row.state.title).toBe('New row');
    expect(tabs.getCurrentTab()).toBe(destination);
    expect(sourceTab.getLayout()).toBeInstanceOf(AutoGridLayoutManager);
    expect(sourceTab.getLayout().getVizPanels()).toEqual([]);
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(sourceTab.getLayout()).toBe(source);
    expect(source.state.rows).toEqual([row]);
    expect(row.parent).toBe(source);
    expect(destination.getLayout()).toBe(previousDestination);
    expect(previousDestination.parent).toBe(destination);
    expect(previousDestination.state.rows).toEqual([existingRow]);
    expect(tabs.getCurrentTab()).toBe(sourceTab);
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('moves the last source row into an empty tab and restores its original layout on undo', () => {
    const row = new RowItem({ title: 'New row', layout: AutoGridLayoutManager.createEmpty() });
    const source = new RowsLayoutManager({ rows: [row] });
    const previousDestination = AutoGridLayoutManager.createEmpty();
    const sourceTab = new TabItem({ title: 'Source', layout: source });
    const destination = new TabItem({ title: 'Destination', layout: previousDestination });
    const tabs = new TabsLayoutManager({ tabs: [sourceTab, destination], currentTabSlug: sourceTab.getSlug() });
    const dashboard = new DashboardScene({ isEditing: true, body: tabs });
    deactivate = activateFullSceneTree(dashboard);
    const sidebar = dashboard.state.sidebar;

    moveRowToTab({ row, source, destination });
    const movedLayout = destination.getLayout() as RowsLayoutManager;
    expect(movedLayout.state.rows).toEqual([row]);
    expect(previousDestination.parent).toBeUndefined();
    expect(movedLayout.parent).toBe(destination);
    expect(row.parent).toBe(movedLayout);
    expect(row.state.title).toBe('New row');
    expect(tabs.getCurrentTab()).toBe(destination);
    expect(sourceTab.getLayout()).toBeInstanceOf(AutoGridLayoutManager);
    expect(sourceTab.getLayout().getVizPanels()).toEqual([]);
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(sourceTab.getLayout()).toBe(source);
    expect(source.state.rows).toEqual([row]);
    expect(row.parent).toBe(source);
    expect(destination.getLayout()).toBe(previousDestination);
    expect(previousDestination.parent).toBe(destination);
    expect(movedLayout.parent).toBeUndefined();
    expect(tabs.getCurrentTab()).toBe(sourceTab);
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('preserves existing panels when converting the destination to rows and restores the original layout on undo', () => {
    const row = new RowItem({ title: 'New row', layout: AutoGridLayoutManager.createEmpty() });
    const source = new RowsLayoutManager({ rows: [row] });
    const previousDestination = new AutoGridLayoutManager({
      layout: new AutoGridLayout({
        children: [new AutoGridItem({ body: new VizPanel({ title: 'Existing panel', pluginId: 'table' }) })],
      }),
    });
    const sourceTab = new TabItem({ title: 'Source', layout: source });
    const destination = new TabItem({ title: 'Destination', layout: previousDestination });
    const tabs = new TabsLayoutManager({ tabs: [sourceTab, destination], currentTabSlug: sourceTab.getSlug() });
    const dashboard = new DashboardScene({ isEditing: true, body: tabs });
    deactivate = activateFullSceneTree(dashboard);
    const sidebar = dashboard.state.sidebar;

    moveRowToTab({ row, source, destination });
    const movedLayout = destination.getLayout() as RowsLayoutManager;
    expect(movedLayout.state.rows).toHaveLength(2);
    expect(movedLayout.state.rows[1]).toBe(row);
    expect(
      movedLayout.state.rows[0]
        .getLayout()
        .getVizPanels()
        .map((panel) => panel.state.title)
    ).toEqual(['Existing panel']);
    expect(previousDestination.getVizPanels().map((panel) => panel.state.title)).toEqual(['Existing panel']);
    expect(previousDestination.parent).toBeUndefined();
    expect(movedLayout.parent).toBe(destination);
    expect(row.parent).toBe(movedLayout);
    expect(row.state.title).toBe('New row');
    expect(tabs.getCurrentTab()).toBe(destination);
    expect(sourceTab.getLayout()).toBeInstanceOf(AutoGridLayoutManager);
    expect(sourceTab.getLayout().getVizPanels()).toEqual([]);
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(sourceTab.getLayout()).toBe(source);
    expect(source.state.rows).toEqual([row]);
    expect(row.parent).toBe(source);
    expect(destination.getLayout()).toBe(previousDestination);
    expect(previousDestination.parent).toBe(destination);
    expect(movedLayout.parent).toBeUndefined();
    expect(tabs.getCurrentTab()).toBe(sourceTab);
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);
  });

  it('reuses the converted destination layout through repeated undo and redo', () => {
    const row = new RowItem({ title: 'New row', layout: AutoGridLayoutManager.createEmpty() });
    const source = new RowsLayoutManager({ rows: [row] });
    const previousDestination = AutoGridLayoutManager.createEmpty();
    const sourceTab = new TabItem({ title: 'Source', layout: source });
    const destination = new TabItem({ title: 'Destination', layout: previousDestination });
    const tabs = new TabsLayoutManager({ tabs: [sourceTab, destination], currentTabSlug: sourceTab.getSlug() });
    const dashboard = new DashboardScene({ isEditing: true, body: tabs });
    deactivate = activateFullSceneTree(dashboard);
    const sidebar = dashboard.state.sidebar;

    moveRowToTab({ row, source, destination });
    const movedLayout = destination.getLayout() as RowsLayoutManager;

    sidebar.undoAction();
    sidebar.redoAction();
    expect(destination.getLayout()).toBe(movedLayout);
    expect(movedLayout.state.rows).toEqual([row]);
    expect(row.parent).toBe(movedLayout);
    expect(movedLayout.parent).toBe(destination);

    sidebar.undoAction();
    expect(sourceTab.getLayout()).toBe(source);
    expect(source.state.rows).toEqual([row]);
    expect(row.parent).toBe(source);
    expect(destination.getLayout()).toBe(previousDestination);
    expect(previousDestination.parent).toBe(destination);
    expect(movedLayout.parent).toBeUndefined();
    expect(sidebar.state.undoStack).toHaveLength(0);
    expect(sidebar.state.redoStack).toHaveLength(1);

    sidebar.redoAction();
    expect(destination.getLayout()).toBe(movedLayout);
    expect(movedLayout.state.rows).toEqual([row]);
    expect(row.parent).toBe(movedLayout);
    expect(movedLayout.parent).toBe(destination);
    expect(previousDestination.parent).toBeUndefined();
    expect(sidebar.state.undoStack).toHaveLength(1);
    expect(sidebar.state.redoStack).toHaveLength(0);
  });

  it('keeps source order and restores a title changed to avoid a destination collision', () => {
    const before = new RowItem({ title: 'Before' });
    const row = new RowItem({ title: 'Row' });
    const after = new RowItem({ title: 'After' });
    const source = new RowsLayoutManager({ rows: [before, row, after] });
    const existing = new RowItem({ title: 'Row' });
    const target = new RowsLayoutManager({ rows: [existing] });
    const destination = new TabItem({ layout: target });
    const dashboard = new DashboardScene({
      isEditing: true,
      body: new TabsLayoutManager({ tabs: [new TabItem({ layout: source }), destination] }),
    });
    deactivate = activateFullSceneTree(dashboard);

    moveRowToTab({ row, source, destination });
    expect(source.state.rows).toEqual([before, after]);
    expect(target.state.rows).toEqual([existing, row]);
    expect(row.state.title).toBe('Row 1');
    dashboard.state.sidebar.undoAction();
    expect(source.state.rows).toEqual([before, row, after]);
    expect(target.state.rows).toEqual([existing]);
    expect(row.state.title).toBe('Row');
  });
});
