import { type RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { moveElement } from '../element/moveElement';

export function reorderRows(layout: RowsLayoutManager, fromIndex: number, toIndex: number) {
  const originalRows = [...layout.state.rows];
  const reorderedRows = [...originalRows];
  const [row] = reorderedRows.splice(fromIndex, 1);
  reorderedRows.splice(toIndex, 0, row);

  moveElement({
    source: layout,
    movedObject: row,
    selectOnMove: false,
    perform: () => {
      layout.setState({ rows: reorderedRows });
      layout.publishEvent(new ObjectsReorderedOnCanvasEvent(layout), true);
    },
    undo: () => {
      layout.setState({ rows: originalRows });
      layout.publishEvent(new ObjectsReorderedOnCanvasEvent(layout), true);
    },
  });
}
