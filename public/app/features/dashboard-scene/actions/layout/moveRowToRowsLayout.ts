import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { type RowItem } from '../../scene/layout-rows/RowItem';
import { type RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { generateUniqueTitle } from '../../scene/layouts-shared/utils';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { getDashboardSceneFor } from '../../utils/utils';
import { moveElement } from '../element/moveElement';

/**
 * Moves a row into another rows layout at the given position, for rows layouts that aren't the
 * layout of a tab (those go through `moveRowToTab`). A source left without rows becomes an empty
 * grid, like after removing its last row.
 */
export function moveRowToRowsLayout({
  row,
  source,
  destination,
  index,
}: {
  row: RowItem;
  source: RowsLayoutManager;
  destination: RowsLayoutManager;
  /** Where among the destination's rows to insert the row */
  index: number;
}) {
  if (destination === source) {
    return;
  }
  const sourceParent = source.parent;
  if (!sourceParent || !isLayoutParent(sourceParent)) {
    throw new Error('Parent object is not a LayoutParent');
  }

  const dashboard = getDashboardSceneFor(source);
  const sourceRows = [...source.state.rows];
  const sourceNewRows = sourceRows.filter((item) => item !== row);
  const previousRows = [...destination.state.rows];
  const nextRows = [...previousRows];
  nextRows.splice(index, 0, row);
  const previousTitle = row.state.title;
  const existingTitles = new Set(previousRows.map((item) => item.state.title).filter((title) => title !== undefined));
  const nextTitle = generateUniqueTitle(previousTitle, existingTitles);

  moveElement({
    meta: { actionId: 'row.move', scope: 'rows-layout' },
    source: dashboard,
    movedObject: row,
    selectOnMove: false,
    perform: () => {
      source.setState({ rows: sourceNewRows });
      row.clearParent();
      if (sourceNewRows.length === 0) {
        sourceParent.switchLayout(AutoGridLayoutManager.createEmpty(), true);
      }
      row.setState({ title: nextTitle });
      destination.setState({ rows: nextRows });
      dashboard.publishEvent(new ObjectsReorderedOnCanvasEvent(dashboard), true);
    },
    undo: () => {
      destination.setState({ rows: previousRows });
      row.clearParent();
      row.setState({ title: previousTitle });
      source.setState({ rows: sourceRows });
      if (sourceNewRows.length === 0) {
        sourceParent.switchLayout(source, true);
      }
      dashboard.publishEvent(new ObjectsReorderedOnCanvasEvent(dashboard), true);
    },
  });
}
