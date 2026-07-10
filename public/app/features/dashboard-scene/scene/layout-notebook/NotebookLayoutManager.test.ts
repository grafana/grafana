import { type NotebookLayoutKind } from '@grafana/schema/apis/notebook/v2beta1';

import { NotebookCellItem } from './NotebookCellItem';
import { NotebookLayoutManager } from './NotebookLayoutManager';

describe('NotebookLayoutManager.serialize', () => {
  it('returns a typed NotebookLayoutKind without a cast', () => {
    const manager = new NotebookLayoutManager({
      cells: [new NotebookCellItem({ elementName: 'md1', source: 'assistant' })],
    });

    // The generic DashboardLayoutManager<{}, NotebookLayoutKind> lets serialize() return the
    // notebook's own kind directly: this annotation compiles with no `as unknown as` cast.
    const result: NotebookLayoutKind = manager.serialize();

    expect(result.kind).toBe('NotebookLayout');
  });

  it('preserves cell order and source', () => {
    const manager = new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({ elementName: 'panel1', source: 'user' }),
        new NotebookCellItem({ elementName: 'md1', source: 'assistant' }),
      ],
    });

    const result = manager.serialize();

    expect(result.spec.cells.map((cell) => cell.spec.element.name)).toEqual(['panel1', 'md1']);
    expect(result.spec.cells.map((cell) => cell.spec.source)).toEqual(['user', 'assistant']);
  });

  it('omits collapsed when it was never set, but keeps an explicit false', () => {
    const manager = new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({ elementName: 'a', source: 'user' }),
        new NotebookCellItem({ elementName: 'b', source: 'user', collapsed: false }),
        new NotebookCellItem({ elementName: 'c', source: 'user', collapsed: true }),
      ],
    });

    const [unset, explicitFalse, explicitTrue] = manager.serialize().spec.cells;

    expect('collapsed' in unset.spec).toBe(false);
    expect(explicitFalse.spec.collapsed).toBe(false);
    expect(explicitTrue.spec.collapsed).toBe(true);
  });
});
