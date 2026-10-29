import { groupRowIntoTab } from '../../../actions/layout/groupRowIntoTab';
import { moveRowToRowsLayout } from '../../../actions/layout/moveRowToRowsLayout';
import { moveRowToTab } from '../../../actions/layout/moveRowToTab';
import { moveTabToTabsLayout } from '../../../actions/layout/moveTabToTabsLayout';
import { reorderRows } from '../../../actions/layout/reorderRows';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';
import { hasGridRows } from '../../layout-default/custom-grid/gridItemLayout';
import { type RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../../types/DashboardLayoutManager';

import { type ListDropTarget, type ListItem, type ListLayout } from './listDnd';

/** Drops the item on the target as one undoable action. Nothing happens when the item would stay where it is. */
export function commitListDrop(item: ListItem, source: ListLayout, target: ListDropTarget): void {
  if (item instanceof TabItem) {
    if (source instanceof TabsLayoutManager && target.kind === 'list' && target.list instanceof TabsLayoutManager) {
      commitTabDrop(item, source, target.list, target.index);
    }
    return;
  }
  if (!(source instanceof RowsLayoutManager)) {
    return;
  }
  commitRowDrop(item, source, target);
}

function commitRowDrop(item: RowItem, source: RowsLayoutManager, target: ListDropTarget): void {
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
  if (!(list instanceof RowsLayoutManager)) {
    return;
  }
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

function commitTabDrop(tab: TabItem, source: TabsLayoutManager, list: TabsLayoutManager, index: number): void {
  if (list !== source) {
    moveTabToTabsLayout({ tab, source, destination: list, index });
    return;
  }

  const fromIndex = source.state.tabs.indexOf(tab);
  if (fromIndex === -1 || fromIndex === index) {
    return;
  }
  // `moveTab` counts repeated copies, and moves the tab to where the tab it is given was
  const allTabs = source.getTabsIncludingRepeats();
  source.moveTab(allTabs.indexOf(tab), allTabs.indexOf(source.state.tabs[index]));
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
