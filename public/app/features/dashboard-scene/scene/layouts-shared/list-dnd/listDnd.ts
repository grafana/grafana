import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { isRepeatCloneOrChildOf } from '../../../utils/clone';
import { type RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../../types/DashboardDropTarget';
import { getGroupDepth, MAX_NESTING_DEPTH } from '../nestingRestrictions';

import { LIST_DROP_KEY_ATTR, LIST_ITEM_KEY_ATTR, TAB_ACTIVATION_KEY_ATTR } from './attributes';

/** An item a list drag session can drag */
export type ListItem = RowItem | TabItem;
/** A layout that holds list items in order: rows one below the other, or a tab bar */
export type ListLayout = RowsLayoutManager | TabsLayoutManager;

export type ListDropTarget =
  | {
      kind: 'list';
      list: ListLayout;
      /** Insertion index among the list's items, not counting the dragged item */
      index: number;
    }
  | {
      /**
       * Into a tab: after its rows, or, when the tab doesn't hold rows, in a new rows layout next to the
       * tab's current content
       */
      kind: 'tab';
      tab: TabItem;
    };

export function getListOf(item: ListItem): ListLayout | undefined {
  const parent = item.parent;
  if (item instanceof TabItem) {
    return parent instanceof TabsLayoutManager ? parent : undefined;
  }
  return parent instanceof RowsLayoutManager ? parent : undefined;
}

/** Rows go into rows layouts and tabs into tab bars */
function holdsItemsLike(list: SceneObject, item: ListItem): list is ListLayout {
  return item instanceof TabItem ? list instanceof TabsLayoutManager : list instanceof RowsLayoutManager;
}

export function isSameListDropTarget(a: ListDropTarget | null, b: ListDropTarget | null): boolean {
  if (!a || !b) {
    return a === b;
  }
  if (a.kind === 'list' && b.kind === 'list') {
    return a.list === b.list && a.index === b.index;
  }
  return a.kind === 'tab' && b.kind === 'tab' && a.tab === b.tab;
}

/** Number of row and tab groups from the top of the dashboard down to and including this object */
function getGroupsAbove(obj: SceneObject): number {
  let depth = 0;
  for (let current: SceneObject | undefined = obj; current; current = current.parent) {
    if (current instanceof RowsLayoutManager || current instanceof TabsLayoutManager) {
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
 * Whether the item can be dropped into the list: a list of the same kind, not inside the item itself
 * or a repeated copy, and without nesting anything deeper than the grouping actions allow
 */
export function canDropIntoList(item: ListItem, list: ListLayout): boolean {
  if (!holdsItemsLike(list, item) || isInside(list, item) || isRepeatCloneOrChildOf(list)) {
    return false;
  }
  if (getListOf(item) === list) {
    return true;
  }
  return getGroupsAbove(list) + getGroupDepth(item.state.layout) <= MAX_NESTING_DEPTH;
}

/** Whether the row can be dropped into the tab, see the `tab` drop target */
export function canDropIntoTab(item: RowItem, tab: TabItem): boolean {
  const layout = tab.state.layout;
  if (layout instanceof RowsLayoutManager) {
    return canDropIntoList(item, layout);
  }
  if (isInside(tab, item) || isRepeatCloneOrChildOf(tab)) {
    return false;
  }
  // The new rows layout holds both the item and the tab's current content
  const newListDepth = getGroupsAbove(tab) + 1;
  return newListDepth + Math.max(getGroupDepth(item.state.layout), getGroupDepth(layout)) <= MAX_NESTING_DEPTH;
}

/**
 * Where to insert along one axis: before the first item whose midpoint is past the pointer.
 * `items` are the other items of the list in rendered order, without the dragged one.
 */
export function getInsertIndex(items: Array<{ start: number; end: number }>, pointer: number): number {
  const index = items.findIndex((item) => pointer < (item.start + item.end) / 2);
  return index === -1 ? items.length : index;
}

/** The list's own item elements in DOM order, without the items of lists nested inside it */
export function getListItemElements(listEl: Element): HTMLElement[] {
  return [...listEl.querySelectorAll<HTMLElement>(`[${LIST_ITEM_KEY_ATTR}]`)].filter(
    (el) => el.closest(`[${LIST_DROP_KEY_ATTR}]`) === listEl
  );
}

/**
 * The span of each of the list's items other than `itemKey` along the list's axis, an item and its
 * repeated copies as one: vertical for rows, horizontal for the tabs of a tab bar
 */
function getOtherItemSpans(
  listEl: Element,
  itemKey: string | undefined,
  axis: 'x' | 'y'
): Array<{ start: number; end: number }> {
  const spans = new Map<string, { start: number; end: number }>();
  for (const el of getListItemElements(listEl)) {
    const key = el.getAttribute(LIST_ITEM_KEY_ATTR);
    if (!key || key === itemKey) {
      continue;
    }
    const { top, bottom, left, right } = el.getBoundingClientRect();
    const [start, end] = axis === 'x' ? [left, right] : [top, bottom];
    const span = spans.get(key);
    spans.set(key, span ? { start: Math.min(span.start, start), end: Math.max(span.end, end) } : { start, end });
  }
  return [...spans.values()];
}

/**
 * Hit-testing for one drag: where the item would land if it were dropped at a point. The innermost
 * place under the point that accepts the item wins, so a row that can't go into a nested list goes
 * next to it instead. Hovering the header of the tab a row comes from means no drop.
 *
 * Tabs only go into tab bars: over a tab bar nested in the tab itself, a row or anything else that
 * isn't a tab bar, there is no drop.
 */
export function createListDropTargetFinder(item: ListItem): (x: number, y: number) => ListDropTarget | null {
  const root = item.getRoot();
  const sourceList = getListOf(item);
  // Keys don't change during a drag, and looking them up walks the whole dashboard
  const objects = new Map<string, SceneObject | null>();
  const findByKey = (key: string) => {
    if (!objects.has(key)) {
      objects.set(
        key,
        sceneGraph.findObject(root, (obj) => obj.state.key === key)
      );
    }
    return objects.get(key) ?? null;
  };

  return (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const listKey = el.getAttribute(LIST_DROP_KEY_ATTR);
      const list = listKey ? findByKey(listKey) : null;
      if (list && holdsItemsLike(list, item) && canDropIntoList(item, list)) {
        const axis = list instanceof TabsLayoutManager ? 'x' : 'y';
        const spans = getOtherItemSpans(el, item.state.key, axis);
        return { kind: 'list', list, index: getInsertIndex(spans, axis === 'x' ? x : y) };
      }

      if (item instanceof TabItem) {
        continue;
      }

      const tabHeaderKey = el.getAttribute(TAB_ACTIVATION_KEY_ATTR);
      if (tabHeaderKey) {
        const tab = findByKey(tabHeaderKey);
        if (tab instanceof TabItem && tab.state.layout === sourceList) {
          return null;
        }
        if (tab instanceof TabItem && canDropIntoTab(item, tab)) {
          return { kind: 'tab', tab };
        }
        continue;
      }

      // The content of a tab that doesn't hold rows yet
      const dropTargetKey = el.getAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR);
      const tab = dropTargetKey ? findByKey(dropTargetKey) : null;
      if (tab instanceof TabItem && !(tab.state.layout instanceof RowsLayoutManager) && canDropIntoTab(item, tab)) {
        return { kind: 'tab', tab };
      }
    }
    return null;
  };
}
