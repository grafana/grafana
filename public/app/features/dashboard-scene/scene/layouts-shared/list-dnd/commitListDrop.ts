import { groupRowIntoTab } from '../../../actions/layout/groupRowIntoTab';
import { moveRowToRowsLayout } from '../../../actions/layout/moveRowToRowsLayout';
import { moveRowToTab } from '../../../actions/layout/moveRowToTab';
import { reorderRows } from '../../../actions/layout/reorderRows';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';
import { hasGridRows } from '../../layout-default/custom-grid/gridItemLayout';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { type DashboardLayoutManager } from '../../types/DashboardLayoutManager';

import { type ListDropTarget, type ListItem, type ListLayout } from './listDnd';

/** Drops the item on the target as one undoable action. Nothing happens when the item would stay where it is. */
export function commitListDrop(item: ListItem, source: ListLayout, target: ListDropTarget): void {
  if (target.kind === 'tab') {
    const layout = target.tab.getLayout();
    if (layout === source) {
      return;
    }
    if (canWrapInRow(layout)) {
      groupRowIntoTab({ row: item, source, tab: target.tab });
    } else {
      moveRowToTab({ row: item, source, destination: target.tab });
    }
    return;
  }

  const { list, index } = target;
  if (list === source) {
    const fromIndex = source.state.rows.indexOf(item);
    if (fromIndex !== -1 && fromIndex !== index) {
      reorderRows(source, fromIndex, index);
    }
  } else if (list.parent instanceof TabItem) {
    moveRowToTab({ row: item, source, destination: list.parent, index });
  } else {
    moveRowToRowsLayout({ row: item, source, destination: list, index });
  }
}

/**
 * Whether a tab's layout can go into a row as it is. An empty one isn't worth a row of its own, and
 * the rows of a custom grid become rows of their own (that's what `moveRowToTab` does for both).
 */
function canWrapInRow(layout: DashboardLayoutManager): boolean {
  if (layout instanceof RowsLayoutManager || layout.getVizPanels().length === 0) {
    return false;
  }
  return !(layout instanceof DefaultGridLayoutManager && hasGridRows(layout.state.grid));
}
