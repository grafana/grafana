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

  it.each(['rows', 'empty', 'panels'] as const)(
    'moves the last source row into %s and restores both layouts through repeated undo/redo',
    (kind) => {
      const row = new RowItem({ title: 'New row', layout: AutoGridLayoutManager.createEmpty() });
      const source = new RowsLayoutManager({ rows: [row] });
      const existingRow = new RowItem({ title: 'Existing row', layout: AutoGridLayoutManager.createEmpty() });
      const previousDestination =
        kind === 'rows'
          ? new RowsLayoutManager({ rows: [existingRow] })
          : new AutoGridLayoutManager({
              layout: new AutoGridLayout({
                children:
                  kind === 'panels'
                    ? [new AutoGridItem({ body: new VizPanel({ title: 'Existing panel', pluginId: 'table' }) })]
                    : [],
              }),
            });
      const sourceTab = new TabItem({ title: 'Source', layout: source });
      const destination = new TabItem({ title: 'Destination', layout: previousDestination });
      const tabs = new TabsLayoutManager({
        tabs: [sourceTab, destination],
        currentTabSlug: sourceTab.getSlug(),
      });
      const dashboard = new DashboardScene({ isEditing: true, body: tabs });
      deactivate = activateFullSceneTree(dashboard);
      const sidebar = dashboard.state.sidebar;

      moveRowToTab({ row, source, destination });
      const movedLayout = destination.getLayout() as RowsLayoutManager;
      for (let cycle = 0; cycle < 3; cycle++) {
        expect(destination.getLayout()).toBe(movedLayout);
        expect(movedLayout.parent).toBe(destination);
        expect(tabs.getCurrentTab()).toBe(destination);
        expect(movedLayout.state.rows.at(-1)).toBe(row);
        if (kind === 'empty') {
          expect(movedLayout.state.rows).toEqual([row]);
        }
        if (kind !== 'rows') {
          expect(previousDestination.parent).toBeUndefined();
        }
        expect(row.parent).toBe(movedLayout);
        expect(row.state.title).toBe('New row');
        expect(sourceTab.getLayout()).toBeInstanceOf(AutoGridLayoutManager);
        expect(sidebar.state.undoStack).toHaveLength(1);
        if (kind === 'rows') {
          expect(movedLayout).toBe(previousDestination);
          expect(movedLayout.state.rows).toEqual([existingRow, row]);
        }
        if (kind === 'panels') {
          expect(movedLayout.state.rows).toHaveLength(2);
          expect(
            movedLayout.state.rows[0]
              .getLayout()
              .getVizPanels()
              .map((panel) => panel.state.title)
          ).toEqual(['Existing panel']);
          expect(previousDestination.getVizPanels().map((panel) => panel.state.title)).toEqual(['Existing panel']);
        }

        sidebar.undoAction();
        expect(sourceTab.getLayout()).toBe(source);
        expect(source.state.rows).toEqual([row]);
        expect(row.parent).toBe(source);
        expect(destination.getLayout()).toBe(previousDestination);
        expect(previousDestination.parent).toBe(destination);
        if (kind !== 'rows') {
          expect(movedLayout.parent).toBeUndefined();
        }
        expect(tabs.getCurrentTab()).toBe(sourceTab);
        expect(sidebar.state.undoStack).toHaveLength(0);
        expect(sidebar.state.redoStack).toHaveLength(1);

        sidebar.redoAction();
        expect(destination.getLayout()).toBe(movedLayout);
      }
    }
  );

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
