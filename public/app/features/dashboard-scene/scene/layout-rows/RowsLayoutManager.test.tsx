import { VariableHide } from '@grafana/data';
import { ConstantVariable, SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import { dashboardEditActions } from '../../sidebar/shared';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { ungroupLayout } from '../layouts-shared/utils';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

let lastUndo: (() => void) | undefined;
let lastEditPerform: (() => void) | undefined;
let lastEditUndo: (() => void) | undefined;
let ungroupLayoutCalled = false;

jest.mock('../../sidebar/shared', () => ({
  dashboardEditActions: {
    addElement: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
    removeElement: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
    edit: jest.fn(({ perform, undo }) => {
      perform();
      lastEditPerform = perform;
      lastEditUndo = undo;
    }),
  },
}));

jest.mock('../layouts-shared/utils', () => ({
  ...jest.requireActual('../layouts-shared/utils'),
  ungroupLayout: jest.fn(() => {
    ungroupLayoutCalled = true;
  }),
}));

function buildRowsLayoutManager(rows: RowItem[] = []) {
  const rowsLayoutManager = new RowsLayoutManager({ key: 'test-RowsLayoutManager', rows });
  new DashboardScene({ body: rowsLayoutManager });
  return rowsLayoutManager;
}

describe('RowsLayoutManager', () => {
  describe('getSlug', () => {
    it('generates slugs based on row titles', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const row1 = rowsLayoutManager.addNewRow(new RowItem({ title: 'My Row Title' }));
      const row2 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Another Row!' }));

      expect(row1.getSlug()).toBe('My-Row-Title');
      expect(row2.getSlug()).toBe('Another-Row!');
    });

    it('disambiguates slugs when multiple titles are encoded to the same value', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const firstRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'New row 1' }));
      const secondRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'New row-1' }));

      expect(firstRow.getSlug()).toBe('New-row-1');
      expect(secondRow.getSlug()).toBe('New-row-1__2');
    });

    it('keeps clean slugs when there is no slug duplication', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const firstRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row One' }));
      const secondRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row Two' }));

      expect(firstRow.getSlug()).toBe('Row-One');
      expect(secondRow.getSlug()).toBe('Row-Two');
    });

    it('keeps slug values stable across different row layout instances', () => {
      const titles = ['New row 1', 'New row-1', 'Other row'];

      const getSlugsFromFreshLayout = () => {
        const rows = titles.map((title) => new RowItem({ title }));
        buildRowsLayoutManager(rows);
        return rows.map((row) => row.getSlug());
      };

      const firstRunSlugs = getSlugsFromFreshLayout();
      const secondRunSlugs = getSlugsFromFreshLayout();

      expect(firstRunSlugs).toEqual(['New-row-1', 'New-row-1__2', 'Other-row']);
      expect(secondRunSlugs).toEqual(firstRunSlugs);
    });
  });

  describe('addNewRow', () => {
    beforeEach(() => {
      lastUndo = undefined;
    });

    it('should add a new row with default title when no title is provided', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const newRow = rowsLayoutManager.addNewRow();

      expect(newRow).toBeInstanceOf(RowItem);
      expect(newRow.state.title).toBe('New row');
      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(newRow);
    });

    it('should add a row with the provided title if it is unique', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const newRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Unique Title' }));

      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(newRow);
      expect(newRow.state.title).toBe('Unique Title');
    });

    it('should generate a unique title when adding a row with a duplicate title', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const firstRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));
      const secondRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(rowsLayoutManager.state.rows).toHaveLength(2);
      expect(firstRow.state.title).toBe('Test Title');
      expect(secondRow.state.title).toBe('Test Title 1');
    });

    it('should increment the number in the title for multiple duplicates', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const firstRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));
      const secondRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));
      const thirdRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(rowsLayoutManager.state.rows).toHaveLength(3);
      expect(firstRow.state.title).toBe('Test Title');
      expect(secondRow.state.title).toBe('Test Title 1');
      expect(thirdRow.state.title).toBe('Test Title 2');
    });

    it('should handle undo action correctly', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(rowsLayoutManager.state.rows).toHaveLength(1);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo!();

      expect(rowsLayoutManager.state.rows).toHaveLength(0);
    });

    it('should sync edit mode to a new row inner layout when the dashboard is already editing', () => {
      // New rows use getDefaultLayout() (clone of preferences.defaultLayoutTemplate). Without a template,
      // RowItem falls back to AutoGridLayoutManager.createEmpty(), which already has isDraggable true, so a
      // missing edit-mode sync would not fail the test. A template with interaction disabled forces the sync.
      const defaultLayoutTemplate = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [],
          isDraggable: false,
          isResizable: false,
        }),
      });

      const rowsLayoutManager = new RowsLayoutManager({
        key: 'test-RowsLayoutManager',
        rows: [new RowItem({ title: 'First' })],
      });
      new DashboardScene({
        body: rowsLayoutManager,
        isEditing: true,
        editable: true,
        preferences: { defaultLayoutTemplate },
      });

      rowsLayoutManager.editModeChanged(true);

      const newRow = rowsLayoutManager.addNewRow();
      const layout = newRow.getLayout();
      expect(layout).toBeInstanceOf(DefaultGridLayoutManager);

      const grid = (layout as DefaultGridLayoutManager).state.grid;
      expect(grid.state.isDraggable).toBe(true);
      expect(grid.state.isResizable).toBe(true);
    });
  });

  describe('removeRow', () => {
    beforeEach(() => {
      lastUndo = undefined;
      ungroupLayoutCalled = false;
      jest.clearAllMocks();
    });

    it('should remove a row and call the removeElement action', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const row1 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 1' }));
      const row2 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 2' }));

      rowsLayoutManager.removeRow(row1);

      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(row2);
      expect(dashboardEditActions.removeElement).toHaveBeenCalled();
    });

    it('should handle undo action correctly', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const row1 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 1' }));
      const row2 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 2' }));

      rowsLayoutManager.removeRow(row1);

      expect(typeof lastUndo).toBe('function');
      lastUndo!();

      expect(rowsLayoutManager.state.rows).toHaveLength(2);
      expect(rowsLayoutManager.state.rows[0]).toBe(row1);
      expect(rowsLayoutManager.state.rows[1]).toBe(row2);
    });

    it('should not call ungroupLayout when removing the last row', () => {
      const rowsLayoutManager = buildRowsLayoutManager();
      const row = rowsLayoutManager.addNewRow(new RowItem({ title: 'Only Row' }));

      rowsLayoutManager.removeRow(row);

      // This behavior was changed in the PR https://github.com/grafana/grafana/pull/112575
      // The delete row button should have one consistent behavior, no matter if it's the last row or not.
      expect(ungroupLayoutCalled).toBe(false);
    });

    describe('when the last row is removed', () => {
      it('should switch the parent layout to an empty layout of the same type as the removed row', () => {
        const rowsLayoutManager = buildRowsLayoutManager();
        const row = rowsLayoutManager.addNewRow(new RowItem({ title: 'Only Row' }));

        rowsLayoutManager.removeRow(row);

        const parentLayoutManager = (rowsLayoutManager.parent as DashboardScene).state.body;
        expect(parentLayoutManager).toBeInstanceOf(AutoGridLayoutManager);
        expect(parentLayoutManager.getVizPanels()).toHaveLength(0);
      });

      it('should handle undo action correctly', () => {
        const rowsLayoutManager = buildRowsLayoutManager();
        const row = rowsLayoutManager.addNewRow(new RowItem({ title: 'Only Row' }));
        const parent = rowsLayoutManager.parent as DashboardScene;

        rowsLayoutManager.removeRow(row);

        expect(typeof lastUndo).toBe('function');
        lastUndo!();

        expect(parent.state.body).toBe(rowsLayoutManager);
        expect(rowsLayoutManager.state.rows).toHaveLength(1);
        expect(rowsLayoutManager.state.rows[0]).toBe(row);
      });
    });
  });

  describe('hoistNestedGroups', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should hoist nested tabs to the top level when hoisting to tabs', () => {
      const tab1 = new TabItem({ title: 'Tab 1' });
      const tab2 = new TabItem({ title: 'Tab 2' });
      const tab3 = new TabItem({ title: 'Tab 3' });
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({ title: 'Row 1', layout: new TabsLayoutManager({ tabs: [tab1, tab2] }) }),
        new RowItem({ title: 'Row 2', layout: new TabsLayoutManager({ tabs: [tab3] }) }),
      ]);

      rowsLayoutManager.hoistNestedGroups('tabs');

      expect(ungroupLayout).toHaveBeenCalledTimes(1);
      const [source, newLayout, skipUndo] = (ungroupLayout as jest.Mock).mock.calls[0];
      expect(source).toBe(rowsLayoutManager);
      expect(skipUndo).toBe(true);
      expect(newLayout).toBeInstanceOf(TabsLayoutManager);
      expect(newLayout.state.tabs).toHaveLength(3);
      expect(newLayout.state.tabs[0]).toBe(tab1);
      expect(newLayout.state.tabs[1]).toBe(tab2);
      expect(newLayout.state.tabs[2]).toBe(tab3);
    });

    it('should convert grid rows and nested rows into tabs when hoisting to tabs', () => {
      const gridLayout = AutoGridLayoutManager.createEmpty();
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({ title: 'Tabs row', layout: new TabsLayoutManager({ tabs: [new TabItem({ title: 'Tab 1' })] }) }),
        new RowItem({
          title: 'Rows row',
          layout: new RowsLayoutManager({ rows: [new RowItem({ title: 'Inner row' })] }),
        }),
        new RowItem({ title: 'Grid row', layout: gridLayout }),
      ]);

      rowsLayoutManager.hoistNestedGroups('tabs');

      const newLayout = (ungroupLayout as jest.Mock).mock.calls[0][1] as TabsLayoutManager;
      expect(newLayout.state.tabs.map((tab) => tab.state.title)).toEqual(['Tab 1', 'Inner row', 'Grid row']);
      expect(newLayout.state.tabs[2].state.layout).toBe(gridLayout);
    });

    it('should move section variables of dissolved rows up to the dashboard', () => {
      const variable = new ConstantVariable({ name: 'env', value: 'prod' });
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({
          title: 'Outer',
          layout: new RowsLayoutManager({ rows: [new RowItem({ title: 'Inner' })] }),
          $variables: new SceneVariableSet({ variables: [variable] }),
        }),
      ]);
      const scene = rowsLayoutManager.parent as DashboardScene;

      rowsLayoutManager.hoistNestedGroups('rows');

      expect(scene.state.$variables?.state.variables).toContain(variable);
    });

    it('should hoist nested rows into this layout and convert nested tabs into rows when hoisting to rows', () => {
      const innerRow1 = new RowItem({ title: 'Inner 1' });
      const innerRow2 = new RowItem({ title: 'Inner 2' });
      const gridRow = new RowItem({ title: 'Grid row' });
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({ title: 'Outer', layout: new RowsLayoutManager({ rows: [innerRow1, innerRow2] }) }),
        new RowItem({
          title: 'Tabs row',
          layout: new TabsLayoutManager({ tabs: [new TabItem({ title: 'Inner tab' })] }),
        }),
        gridRow,
      ]);

      rowsLayoutManager.hoistNestedGroups('rows');

      expect(ungroupLayout).not.toHaveBeenCalled();
      expect(rowsLayoutManager.state.rows.map((row) => row.state.title)).toEqual([
        'Inner 1',
        'Inner 2',
        'Inner tab',
        'Grid row',
      ]);
      expect(rowsLayoutManager.state.rows[0]).toBe(innerRow1);
      expect(rowsLayoutManager.state.rows[1]).toBe(innerRow2);
      expect(rowsLayoutManager.state.rows[3]).toBe(gridRow);
    });
  });

  describe('ungroupRows', () => {
    let publishSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      lastEditPerform = undefined;
      lastEditUndo = undefined;
      publishSpy = jest.spyOn(appEvents, 'publish').mockImplementation(() => {});
    });

    afterEach(() => {
      publishSpy.mockRestore();
    });

    it('should hoist nested tabs without any modal when at the top level', () => {
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({ title: 'Row 1', layout: new TabsLayoutManager({ tabs: [new TabItem({ title: 'Tab 1' })] }) }),
      ]);

      rowsLayoutManager.ungroupRows();

      expect(publishSpy).not.toHaveBeenCalled();
      expect(ungroupLayout).toHaveBeenCalledTimes(1);
      expect((ungroupLayout as jest.Mock).mock.calls[0][1]).toBeInstanceOf(TabsLayoutManager);
    });

    it('should show the ungroup groups modal when nested groups are mixed', () => {
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({ title: 'Tabs row', layout: new TabsLayoutManager({ tabs: [new TabItem({})] }) }),
        new RowItem({ title: 'Rows row', layout: new RowsLayoutManager({ rows: [new RowItem({})] }) }),
      ]);

      rowsLayoutManager.ungroupRows();

      expect(publishSpy).toHaveBeenCalledTimes(1);
      const event = publishSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(ShowModalReactEvent);
      expect(event.payload.props).toEqual(expect.objectContaining({ disabledTabsReason: undefined }));
    });

    it('should show the ungroup groups modal with the tabs option disabled when a direct child of a tab', () => {
      const rowsLayoutManager = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Tabs row', layout: new TabsLayoutManager({ tabs: [new TabItem({})] }) })],
      });
      new DashboardScene({
        body: new TabsLayoutManager({ tabs: [new TabItem({ title: 'Outer tab', layout: rowsLayoutManager })] }),
      });

      rowsLayoutManager.ungroupRows();

      expect(publishSpy).toHaveBeenCalledTimes(1);
      const event = publishSpy.mock.calls[0][0];
      expect(event).toBeInstanceOf(ShowModalReactEvent);
      expect(event.payload.props).toEqual(expect.objectContaining({ disabledTabsReason: expect.any(String) }));
    });

    it('should hoist nested tabs without any modal when under a tab but not its direct child', () => {
      const rowsLayoutManager = new RowsLayoutManager({
        rows: [new RowItem({ title: 'Tabs row', layout: new TabsLayoutManager({ tabs: [new TabItem({})] }) })],
      });
      new DashboardScene({
        body: new TabsLayoutManager({
          tabs: [
            new TabItem({
              title: 'Outer tab',
              layout: new RowsLayoutManager({ rows: [new RowItem({ title: 'Outer row', layout: rowsLayoutManager })] }),
            }),
          ],
        }),
      });

      rowsLayoutManager.ungroupRows();

      expect(publishSpy).not.toHaveBeenCalled();
      expect(ungroupLayout).toHaveBeenCalledTimes(1);
      expect((ungroupLayout as jest.Mock).mock.calls[0][1]).toBeInstanceOf(TabsLayoutManager);
    });

    it('should ask for confirmation when hoisting would lose repeat options', () => {
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({
          title: 'Rows row',
          repeatByVariable: 'server',
          layout: new RowsLayoutManager({ rows: [new RowItem({})] }),
        }),
      ]);

      rowsLayoutManager.ungroupRows();

      expect(publishSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy.mock.calls[0][0]).toBeInstanceOf(ShowConfirmModalEvent);
    });

    it('should hoist directly without confirmation when dissolved rows only have section variables', () => {
      const variable = new ConstantVariable({ name: 'env', value: 'prod' });
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({
          title: 'Rows row',
          layout: new RowsLayoutManager({ rows: [new RowItem({})] }),
          $variables: new SceneVariableSet({ variables: [variable] }),
        }),
      ]);
      const scene = rowsLayoutManager.parent as DashboardScene;

      rowsLayoutManager.ungroupRows();

      expect(publishSpy).not.toHaveBeenCalled();
      expect(scene.state.$variables?.state.variables).toContain(variable);
    });

    it('should redo the hoist after undo by re-installing the resulting layout', () => {
      const innerRow = new RowItem({ title: 'Inner row' });
      const variable = new ConstantVariable({ name: 'env', value: 'prod' });
      const rowsLayoutManager = buildRowsLayoutManager([
        new RowItem({
          title: 'Outer',
          layout: new RowsLayoutManager({ rows: [innerRow] }),
          $variables: new SceneVariableSet({ variables: [variable] }),
        }),
      ]);
      const scene = rowsLayoutManager.parent as DashboardScene;

      rowsLayoutManager.ungroupRows();

      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(innerRow);
      expect(scene.state.$variables?.state.variables).toContain(variable);

      // Undo detaches the hoisted layout and re-installs a clone of the pre-hoist state
      lastEditUndo!();

      expect(scene.state.body).not.toBe(rowsLayoutManager);
      expect(scene.state.body).toBeInstanceOf(RowsLayoutManager);
      expect(scene.state.$variables?.state.variables ?? []).not.toContain(variable);

      // Redo must re-install the hoist result instead of re-running it on the detached original
      lastEditPerform!();

      expect(scene.state.body).toBe(rowsLayoutManager);
      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(innerRow);
      expect(scene.state.$variables?.state.variables).toContain(variable);
    });
  });

  describe('duplicate', () => {
    it('should return a new RowsLayoutManager instance', () => {
      const rowsLayoutManager = buildRowsLayoutManager();

      const duplicated = rowsLayoutManager.duplicate() as RowsLayoutManager;

      expect(duplicated).toBeInstanceOf(RowsLayoutManager);
      expect(duplicated).not.toBe(rowsLayoutManager);
      expect(duplicated.state.key).not.toBe(rowsLayoutManager.state.key);
    });

    it('should duplicate each row', () => {
      const rows = [new RowItem({ title: 'Row 1' }), new RowItem({ title: 'Row 2' }), new RowItem({ title: 'Row 3' })];
      const rowDuplicateSpies = rows.map((row) => jest.spyOn(row, 'duplicate'));
      const rowsLayoutManager = buildRowsLayoutManager(rows);

      const duplicated = rowsLayoutManager.duplicate() as RowsLayoutManager;

      expect(rowDuplicateSpies[0]).toHaveBeenCalledTimes(1);
      expect(rowDuplicateSpies[1]).toHaveBeenCalledTimes(1);
      expect(rowDuplicateSpies[2]).toHaveBeenCalledTimes(1);

      expect(duplicated.state.rows.length).toBe(3);
      expect(duplicated.state.rows[0]).not.toBe(rows[0]);
      expect(duplicated.state.rows[1]).not.toBe(rows[1]);
      expect(duplicated.state.rows[2]).not.toBe(rows[2]);
    });

    it('should clone section constant variables as independent instances with the same name', () => {
      const constantVar = new ConstantVariable({
        name: 'env',
        type: 'constant',
        value: 'prod',
        hide: VariableHide.hideVariable,
      });
      const originalRow = new RowItem({
        title: 'Row 1',
        layout: AutoGridLayoutManager.createEmpty(),
        $variables: new SceneVariableSet({ variables: [constantVar] }),
      });
      buildRowsLayoutManager([originalRow]);

      const duplicatedRow = originalRow.duplicate();

      const originalConstant = originalRow.state.$variables!.state.variables[0] as ConstantVariable;
      const duplicatedConstant = duplicatedRow.state.$variables!.state.variables[0] as ConstantVariable;

      expect(duplicatedConstant).not.toBe(originalConstant);
      expect(duplicatedConstant.state.key).not.toBe(originalConstant.state.key);
      expect(originalConstant.state.name).toBe('env');
      expect(duplicatedConstant.state.name).toBe('env');
      expect(originalConstant.state.value).toBe('prod');
      expect(duplicatedConstant.state.value).toBe('prod');

      duplicatedConstant.setState({ value: 'staging' });

      expect(originalConstant.state.value).toBe('prod');
      expect(duplicatedConstant.state.value).toBe('staging');
    });

    describe('when rows contain panels', () => {
      it('should assign unique panel keys across all rows, starting after the highest existing id', () => {
        const rowsLayoutManager = buildRowsLayoutManager([
          new RowItem({
            title: 'Row 1',
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
          new RowItem({
            title: 'Row 2',
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

        const duplicated = rowsLayoutManager.duplicate();

        const panelKeys = duplicated.getVizPanels().map((p) => p.state.key);
        expect(panelKeys).toEqual(['panel-5', 'panel-6', 'panel-7', 'panel-8']);
      });
    });
  });
});
