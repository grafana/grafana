import { type RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { moveElement } from '../element/moveElement';

export function reorderRows(layout: RowsLayoutManager, fromIndex: number, toIndex: number) {
  const row = layout.state.rows[fromIndex];

  const moveToIndex = (index: number) => {
    if (!layout.state.rows.includes(row)) {
      return;
    }

    const rows = layout.state.rows.filter((current) => current !== row);
    rows.splice(Math.min(index, rows.length), 0, row);
    layout.setState({ rows });
    layout.publishEvent(new ObjectsReorderedOnCanvasEvent(layout), true);
  };

  moveElement({
    source: layout,
    movedObject: row,
    selectOnMove: false,
    perform: () => moveToIndex(toIndex),
    undo: () => moveToIndex(fromIndex),
  });
}
