import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../DashboardScene';
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

function buildRowsManager(rows: RowItem[] = []) {
  const rowsLayoutManager = new RowsLayoutManager({ rows });
  new DashboardScene({ body: rowsLayoutManager });
  return rowsLayoutManager;
}

describe('RowsLayoutManager', () => {
  describe('addNewRow', () => {
    beforeEach(() => {
      lastUndo = undefined;
    });

    it('should add a new row with default title when no title is provided', () => {
      const rowsLayoutManager = buildRowsManager();
      const newRow = rowsLayoutManager.addNewRow();

      expect(newRow).toBeInstanceOf(RowItem);
      expect(newRow.state.title).toBe('New row');
      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(newRow);
    });

    it('should add a row with the provided title if it is unique', () => {
      const rowsLayoutManager = buildRowsManager();
      const newRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Unique Title' }));

      expect(newRow.state.title).toBe('Unique Title');
      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(newRow);
    });

    it('should generate a unique title when adding a row with a duplicate title', () => {
      const rowsLayoutManager = buildRowsManager();
      const firstRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));
      const secondRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(firstRow.state.title).toBe('Test Title');
      expect(secondRow.state.title).toBe('Test Title 1');
      expect(rowsLayoutManager.state.rows).toHaveLength(2);
    });

    it('should increment the number in the title for multiple duplicates', () => {
      const rowsLayoutManager = buildRowsManager();
      const firstRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));
      const secondRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));
      const thirdRow = rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(firstRow.state.title).toBe('Test Title');
      expect(secondRow.state.title).toBe('Test Title 1');
      expect(thirdRow.state.title).toBe('Test Title 2');
      expect(rowsLayoutManager.state.rows).toHaveLength(3);
    });

    it('should handle undo action correctly', () => {
      const rowsLayoutManager = buildRowsManager();
      rowsLayoutManager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(rowsLayoutManager.state.rows).toHaveLength(1);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo && lastUndo();

      expect(rowsLayoutManager.state.rows).toHaveLength(0);
    });
  });

  describe('removeRow', () => {
    beforeEach(() => {
      lastUndo = undefined;
      ungroupLayoutCalled = false;
      jest.clearAllMocks();
    });

    it('should remove a row and call removeElement', () => {
      const rowsLayoutManager = buildRowsManager();
      const row1 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 1' }));
      const row2 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 2' }));

      rowsLayoutManager.removeRow(row1);

      expect(rowsLayoutManager.state.rows).toHaveLength(1);
      expect(rowsLayoutManager.state.rows[0]).toBe(row2);
      expect(dashboardEditActions.removeElement).toHaveBeenCalled();
    });

    it('should handle undo action correctly', () => {
      const rowsLayoutManager = buildRowsManager();
      const row1 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 1' }));
      const row2 = rowsLayoutManager.addNewRow(new RowItem({ title: 'Row 2' }));

      rowsLayoutManager.removeRow(row1);
      expect(rowsLayoutManager.state.rows).toHaveLength(1);

      expect(typeof lastUndo).toBe('function');
      lastUndo && lastUndo();

      expect(rowsLayoutManager.state.rows).toHaveLength(2);
      expect(rowsLayoutManager.state.rows).toContain(row1);
      expect(rowsLayoutManager.state.rows).toContain(row2);
    });

    it('should not call ungroupLayout when removing the last row', () => {
      const rowsLayoutManager = buildRowsManager();
      const row = rowsLayoutManager.addNewRow(new RowItem({ title: 'Only Row' }));

      rowsLayoutManager.removeRow(row);

      // This behavior was changed in the PR https://github.com/grafana/grafana/pull/112575
      // The delete row button should have one consistent behavior, no matter if it's the last row or not.
      expect(ungroupLayoutCalled).toBe(false);
    });

    describe('when the last row is removed', () => {
      it('should switch the parent scene layout to an empty default grid', () => {
        const rowsLayoutManager = buildRowsManager();
        const row = rowsLayoutManager.addNewRow(new RowItem({ title: 'Only Row' }));
        const parent = rowsLayoutManager.parent as DashboardScene;

        rowsLayoutManager.removeRow(row);

        const layoutManager = parent.state.body;
        expect(layoutManager).toBeInstanceOf(DefaultGridLayoutManager);
      });

      it('should handle undo action correctly', () => {
        const rowsLayoutManager = buildRowsManager();
        const row = rowsLayoutManager.addNewRow(new RowItem({ title: 'Only Row' }));
        const parent = rowsLayoutManager.parent as DashboardScene;

        rowsLayoutManager.removeRow(row);

        expect(typeof lastUndo).toBe('function');
        lastUndo!();

        expect(parent.state.body).toBe(rowsLayoutManager);
        expect(rowsLayoutManager.state.rows).toHaveLength(1);
        expect(rowsLayoutManager.state.rows[0]).toEqual(row);
      });
    });
  });
});
