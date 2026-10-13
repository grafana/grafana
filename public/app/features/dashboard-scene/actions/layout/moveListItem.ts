import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { getListItems, type ListItem, type ListLayout } from '../../scene/layouts-shared/list-dnd/listDnd';
import { generateUniqueTitle } from '../../scene/layouts-shared/utils';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { DashboardStateChangedEvent, ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { moveElement } from '../element/moveElement';

interface MoveListItemProps {
  item: ListItem;
  source: ListLayout;
  destination: ListLayout;
  /** Insertion index in the destination, not counting the moved item */
  index: number;
}

/**
 * Moves a row or tab to a position in the same or another rows/tabs layout as one undoable action.
 */
export function moveListItem({ item, source, destination, index }: MoveListItemProps): void {
  const prevSourceItems = [...getListItems(source)];
  const prevDestinationItems = source === destination ? prevSourceItems : [...getListItems(destination)];
  const fromIndex = prevSourceItems.indexOf(item);
  if (fromIndex === -1) {
    return;
  }

  const nextSourceItems = prevSourceItems.filter((i) => i !== item);
  const insertAt = Math.max(
    0,
    Math.min(index, source === destination ? nextSourceItems.length : prevDestinationItems.length)
  );

  if (source === destination) {
    if (insertAt === fromIndex) {
      return;
    }
    const nextItems = [...nextSourceItems];
    nextItems.splice(insertAt, 0, item);

    moveElement({
      meta: { actionId: item instanceof RowItem ? 'row.reorder' : 'tab.reorder' },
      source,
      movedObject: item,
      perform: () => {
        setItems(source, nextItems);
        notify(source);
      },
      undo: () => {
        setItems(source, prevSourceItems);
        notify(source);
      },
    });
    return;
  }

  const sourceRemoval = getSourceRemoval(item, source);
  if (!sourceRemoval) {
    return;
  }

  const nextDestinationItems = [...prevDestinationItems];
  nextDestinationItems.splice(insertAt, 0, item);

  const prevTitle = item.state.title;
  const existingTitles = new Set(
    prevDestinationItems.map((i) => i.state.title).filter((title): title is string => title !== undefined)
  );
  const nextTitle = generateUniqueTitle(prevTitle, existingTitles);

  const prevDestinationSlug = destination instanceof TabsLayoutManager ? destination.state.currentTabSlug : undefined;

  moveElement({
    meta: { actionId: item instanceof RowItem ? 'row.move' : 'tab.move' },
    source,
    movedObject: item,
    selectOnMove: false,
    perform: () => {
      sourceRemoval.remove();
      if (nextTitle !== prevTitle) {
        item.setState({ title: nextTitle });
      }
      setItems(destination, nextDestinationItems);
      if (destination instanceof TabsLayoutManager) {
        destination.setState({ currentTabSlug: item.getSlug() });
      }
      notify(source);
      notify(destination);
    },
    undo: () => {
      setItems(destination, prevDestinationItems);
      if (destination instanceof TabsLayoutManager) {
        destination.setState({ currentTabSlug: prevDestinationSlug });
      }
      item.clearParent();
      if (nextTitle !== prevTitle) {
        item.setState({ title: prevTitle });
      }
      sourceRemoval.restore();
      notify(source);
      notify(destination);
    },
  });
}

interface GroupRowIntoTabProps {
  row: RowItem;
  source: RowsLayoutManager;
  tab: TabItem;
}

/**
 * Drops a row on a tab whose layout isn't rows: the tab's content becomes a rows layout with the
 * existing content in the first row and the dropped row after it, as one undoable action.
 *
 * The existing layout object is wrapped as is, not converted or cloned, so undo can put the very
 * same object back and nothing inside it (panels, their state) is recreated.
 */
export function groupRowIntoTab({ row, source, tab }: GroupRowIntoTabProps): void {
  const sourceRemoval = getSourceRemoval(row, source);
  if (!sourceRemoval) {
    return;
  }

  const prevLayout = tab.state.layout;
  const parentTabs = tab.getParentLayout();
  const prevTabSlug = parentTabs.state.currentTabSlug;
  // An empty layout isn't worth keeping in a row of its own
  const contentRow = prevLayout.getVizPanels().length > 0 ? new RowItem({}) : undefined;
  const rows = new RowsLayoutManager({ rows: [] });
  const prevTitle = row.state.title;
  const nextTitle = contentRow?.state.title
    ? generateUniqueTitle(prevTitle, new Set([contentRow.state.title]))
    : prevTitle;

  moveElement({
    meta: { actionId: 'row.move', scope: 'group-into-tab' },
    source,
    movedObject: row,
    selectOnMove: false,
    perform: () => {
      sourceRemoval.remove();
      if (nextTitle !== prevTitle) {
        row.setState({ title: nextTitle });
      }
      prevLayout.clearParent();
      contentRow?.setState({ layout: prevLayout });
      rows.setState({ rows: contentRow ? [contentRow, row] : [row] });
      tab.setState({ layout: rows });
      parentTabs.setState({ currentTabSlug: tab.getSlug() });
      notify(source);
      notify(rows);
    },
    undo: () => {
      rows.setState({ rows: [] });
      prevLayout.clearParent();
      row.clearParent();
      tab.setState({ layout: prevLayout });
      parentTabs.setState({ currentTabSlug: prevTabSlug });
      if (nextTitle !== prevTitle) {
        row.setState({ title: prevTitle });
      }
      sourceRemoval.restore();
      notify(source);
      notify(parentTabs);
    },
  });
}

/**
 * Taking an item out of its list, and putting it back on undo. A list left empty is replaced by an
 * empty grid, the same way removing its last row or tab does.
 */
function getSourceRemoval(item: ListItem, source: ListLayout) {
  const sourceParent = source.parent;
  if (!sourceParent || !isLayoutParent(sourceParent)) {
    return undefined;
  }

  const prevItems = [...getListItems(source)];
  const fromIndex = prevItems.indexOf(item);
  const nextItems = prevItems.filter((i) => i !== item);
  const prevSlug = source instanceof TabsLayoutManager ? source.state.currentTabSlug : undefined;
  const isEmptied = nextItems.length === 0;

  return {
    remove() {
      if (isEmptied) {
        sourceParent.switchLayout(AutoGridLayoutManager.createEmpty(), true);
      } else {
        setItems(source, nextItems);
        if (source instanceof TabsLayoutManager && prevSlug === item.getSlug()) {
          source.setState({ currentTabSlug: nextItems[Math.max(0, fromIndex - 1)]?.getSlug() });
        }
      }
      // A scene object can't have two parents, so it has to be free before it is added elsewhere
      item.clearParent();
    },
    restore() {
      item.clearParent();
      // Setting the items again also re-parents the item to the source
      setItems(source, prevItems);
      if (source instanceof TabsLayoutManager) {
        source.setState({ currentTabSlug: prevSlug });
      }
      if (isEmptied) {
        sourceParent.switchLayout(source, true);
      }
    },
  };
}

function setItems(list: ListLayout, items: ListItem[]) {
  if (list instanceof RowsLayoutManager) {
    list.setState({ rows: items.filter((item): item is RowItem => item instanceof RowItem) });
  } else {
    list.setState({ tabs: items.filter((item): item is TabItem => item instanceof TabItem) });
  }
}

function notify(list: ListLayout) {
  // Refreshes the outline and re-runs repeats for the moved item
  list.publishEvent(new ObjectsReorderedOnCanvasEvent(list), true);
  list.publishEvent(new DashboardStateChangedEvent({ source: list }), true);
}
