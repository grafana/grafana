import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

let lastUndo: (() => void) | undefined;
let ungroupLayoutCalled = false;

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
    edit: jest.fn(({ perform }) => {
      perform();
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
      const rowsLayoutManager = new RowsLayoutManager({
        key: 'test-RowsLayoutManager',
        rows: [new RowItem({ title: 'First' })],
      });
      const dashboard = new DashboardScene({
        body: rowsLayoutManager,
        isEditing: true,
        editable: true,
      });
      dashboard.state.body.editModeChanged?.(true);

      const newRow = rowsLayoutManager.addNewRow();
      const layout = newRow.getLayout();

      if (layout instanceof DefaultGridLayoutManager) {
        expect(layout.state.grid.state.isResizable).toBe(true);
        expect(layout.state.grid.state.isDraggable).toBe(true);
      } else if (layout instanceof AutoGridLayoutManager) {
        expect(layout.state.layout.state.isDraggable).toBe(true);
      } else {
        throw new Error(`Unexpected layout type for assertion: ${layout.constructor.name}`);
      }
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
