import { type SceneObject } from '@grafana/scenes';

import { isRepeatCloneOrChildOf } from '../../../utils/clone';
import { RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';
import { getGroupDepth, MAX_NESTING_DEPTH } from '../nestingRestrictions';

import { LIST_DROP_KEY_ATTR, LIST_ITEM_KEY_ATTR } from './attributes';

export type ListItem = RowItem | TabItem;
export type ListLayout = RowsLayoutManager | TabsLayoutManager;

export type ListDropTarget =
  | {
      kind: 'list';
      list: ListLayout;
      /** Insertion index among the list's items, not counting the dragged item */
      index: number;
    }
  | {
      /** A row dropped on a tab whose layout isn't rows: the tab's content gets grouped into rows */
      kind: 'group';
      tab: TabItem;
    };

export interface ListDragState {
  itemKey: string;
  sourceListKey: string;
  target: ListDropTarget | null;
  /** Size of the dragged item, used for the placeholder in other lists */
  placeholderSize: { width: number; height: number };
}

export function getListOf(item: ListItem): ListLayout | undefined {
  const parent = item.parent;
  return parent instanceof RowsLayoutManager || parent instanceof TabsLayoutManager ? parent : undefined;
}

export function getListItems(list: ListLayout): ListItem[] {
  return list instanceof RowsLayoutManager ? list.state.rows : list.state.tabs;
}

/** Number of row/tab groups from the top of the dashboard down to and including this list */
function getListDepth(list: SceneObject): number {
  let depth = 0;
  for (let obj: SceneObject | undefined = list; obj; obj = obj.parent) {
    if (obj instanceof RowsLayoutManager || obj instanceof TabsLayoutManager) {
      depth++;
    }
  }
  return depth;
}

function isInside(obj: SceneObject, ancestor: SceneObject): boolean {
  for (let parent = obj.parent; parent; parent = parent.parent) {
    if (parent === ancestor) {
      return true;
    }
  }
  return false;
}

/**
 * Whether the item can be dropped into the list. Rows only go into rows and tabs into tabs, an
 * item can't be dropped inside itself or into a repeat clone, and the move must not push anything
 * past the maximum nesting depth.
 */
export function canDropInto(item: ListItem, list: ListLayout): boolean {
  const isMatchingKind =
    (item instanceof RowItem && list instanceof RowsLayoutManager) ||
    (item instanceof TabItem && list instanceof TabsLayoutManager);

  if (!isMatchingKind || isInside(list, item) || isRepeatCloneOrChildOf(list)) {
    return false;
  }

  if (getListOf(item) === list) {
    return true;
  }

  return getListDepth(list) + getGroupDepth(item.state.layout) <= MAX_NESTING_DEPTH;
}

/**
 * Whether a row can be dropped on a tab whose content isn't rows. The tab's content is wrapped in a
 * new rows layout next to the dropped row, so both the row and the existing content go one level
 * deeper than the tab.
 */
export function canGroupIntoTab(row: ListItem, tab: TabItem): boolean {
  if (!(row instanceof RowItem) || tab.state.layout instanceof RowsLayoutManager) {
    return false;
  }
  if (isInside(tab, row) || isRepeatCloneOrChildOf(tab)) {
    return false;
  }

  const newRowsDepth = getListDepth(tab) + 1;
  const deepest = Math.max(getGroupDepth(row.state.layout), getGroupDepth(tab.state.layout));
  return newRowsDepth + deepest <= MAX_NESTING_DEPTH;
}

/**
 * Where to insert along one axis: before the first item whose midpoint is past the pointer.
 * `items` are the other items of the list in rendered order, excluding the dragged one.
 */
export function getInsertIndex(items: Array<{ start: number; end: number }>, pointer: number): number {
  const index = items.findIndex((item) => pointer < (item.start + item.end) / 2);
  return index === -1 ? items.length : index;
}

/** The list's own item elements in DOM order, skipping items of lists nested inside it */
export function getListItemElements(listEl: Element): HTMLElement[] {
  return [...listEl.querySelectorAll<HTMLElement>(`[${LIST_ITEM_KEY_ATTR}]`)].filter(
    (el) => el.closest(`[${LIST_DROP_KEY_ATTR}]`) === listEl
  );
}
