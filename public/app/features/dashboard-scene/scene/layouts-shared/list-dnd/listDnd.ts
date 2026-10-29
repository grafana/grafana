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
export type ListItem = RowItem;
/** A layout that holds list items in order */
export type ListLayout = RowsLayoutManager;

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
  return item.parent instanceof RowsLayoutManager ? item.parent : undefined;
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
 * Whether the item can be dropped into the list: not inside itself or a repeated copy, and without
 * nesting anything deeper than the grouping actions allow
 */
export function canDropIntoList(item: ListItem, list: ListLayout): boolean {
  if (isInside(list, item) || isRepeatCloneOrChildOf(list)) {
    return false;
  }
  if (getListOf(item) === list) {
    return true;
  }
  return getGroupsAbove(list) + getGroupDepth(item.state.layout) <= MAX_NESTING_DEPTH;
}

/** Whether the item can be dropped into the tab, see the `tab` drop target */
export function canDropIntoTab(item: ListItem, tab: TabItem): boolean {
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

/** The vertical span of each of the list's items other than `itemKey`, a row and its repeated copies as one */
function getOtherItemSpans(listEl: Element, itemKey: string | undefined): Array<{ start: number; end: number }> {
  const spans = new Map<string, { start: number; end: number }>();
  for (const el of getListItemElements(listEl)) {
    const key = el.getAttribute(LIST_ITEM_KEY_ATTR);
    if (!key || key === itemKey) {
      continue;
    }
    const { top, bottom } = el.getBoundingClientRect();
    const span = spans.get(key);
    spans.set(
      key,
      span ? { start: Math.min(span.start, top), end: Math.max(span.end, bottom) } : { start: top, end: bottom }
    );
  }
  return [...spans.values()];
}

/**
 * Hit-testing for one drag: where the item would land if it were dropped at a point. The innermost
 * place under the point that accepts the item wins, so a row that can't go into a nested list goes
 * next to it instead. Hovering the header of the tab the item comes from means no drop.
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

      const listKey = el.getAttribute(LIST_DROP_KEY_ATTR);
      const list = listKey ? findByKey(listKey) : null;
      if (list instanceof RowsLayoutManager && canDropIntoList(item, list)) {
        return { kind: 'list', list, index: getInsertIndex(getOtherItemSpans(el, item.state.key), y) };
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
