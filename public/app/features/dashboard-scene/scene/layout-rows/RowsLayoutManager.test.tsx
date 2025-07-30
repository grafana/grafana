import { dashboardEditActions } from '../../edit-pane/shared';

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
  },
}));

jest.mock('../layouts-shared/utils', () => ({
  ...jest.requireActual('../layouts-shared/utils'),
  ungroupLayout: jest.fn(() => {
    ungroupLayoutCalled = true;
  }),
}));

describe('RowsLayoutManager', () => {
  describe('addNewRow', () => {
    beforeEach(() => {
      lastUndo = undefined;
    });

    it('should add a new row with default title when no title is provided', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      const newRow = manager.addNewRow();

      expect(newRow).toBeInstanceOf(RowItem);
      expect(newRow.state.title).toBe('New row');
      expect(manager.state.rows).toHaveLength(1);
      expect(manager.state.rows[0]).toBe(newRow);
    });

    it('should add a row with the provided title if it is unique', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      const newRow = manager.addNewRow(new RowItem({ title: 'Unique Title' }));

      expect(newRow.state.title).toBe('Unique Title');
      expect(manager.state.rows).toHaveLength(1);
      expect(manager.state.rows[0]).toBe(newRow);
    });

    it('should generate a unique title when adding a row with a duplicate title', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      const firstRow = manager.addNewRow(new RowItem({ title: 'Test Title' }));
      const secondRow = manager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(firstRow.state.title).toBe('Test Title');
      expect(secondRow.state.title).toBe('Test Title 1');
      expect(manager.state.rows).toHaveLength(2);
    });

    it('should increment the number in the title for multiple duplicates', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      const firstRow = manager.addNewRow(new RowItem({ title: 'Test Title' }));
      const secondRow = manager.addNewRow(new RowItem({ title: 'Test Title' }));
      const thirdRow = manager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(firstRow.state.title).toBe('Test Title');
      expect(secondRow.state.title).toBe('Test Title 1');
      expect(thirdRow.state.title).toBe('Test Title 2');
      expect(manager.state.rows).toHaveLength(3);
    });

    it('should handle undo action correctly', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      manager.addNewRow(new RowItem({ title: 'Test Title' }));

      expect(manager.state.rows).toHaveLength(1);

      // Use the real undo function from the mock
      expect(typeof lastUndo).toBe('function');
      lastUndo && lastUndo();

      expect(manager.state.rows).toHaveLength(0);
    });
  });

  describe('removeRow', () => {
    beforeEach(() => {
      lastUndo = undefined;
      ungroupLayoutCalled = false;
      jest.clearAllMocks();
    });

    it('should remove a row and call removeElement', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      const row1 = manager.addNewRow(new RowItem({ title: 'Row 1' }));
      const row2 = manager.addNewRow(new RowItem({ title: 'Row 2' }));
      expect(manager.state.rows).toHaveLength(2);
      manager.removeRow(row1);
      expect(manager.state.rows).toHaveLength(1);
      expect(manager.state.rows[0]).toBe(row2);
      expect(dashboardEditActions.removeElement).toHaveBeenCalled();
    });

    it('should handle undo action correctly', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      const row1 = manager.addNewRow(new RowItem({ title: 'Row 1' }));
      const row2 = manager.addNewRow(new RowItem({ title: 'Row 2' }));
      manager.removeRow(row1);
      expect(manager.state.rows).toHaveLength(1);
      lastUndo && lastUndo();
      expect(manager.state.rows).toHaveLength(2);
      expect(manager.state.rows).toContain(row1);
      expect(manager.state.rows).toContain(row2);
    });

    it('should call ungroupLayout when removing the last row', () => {
      const manager = new RowsLayoutManager({ rows: [] });
      const row = manager.addNewRow(new RowItem({ title: 'Only Row' }));
      expect(manager.state.rows).toHaveLength(1);
      manager.removeRow(row);
      expect(ungroupLayoutCalled).toBe(true);
    });
  });
});
