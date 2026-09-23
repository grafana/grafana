import { useSyncExternalStore } from 'react';

import { type DashboardLayoutOrchestrator } from '../../DashboardLayoutOrchestrator';

import { type ListDragState } from './listDnd';

export interface ListDragPreview<T> {
  /** Items in the order to render them; the dragged item is moved to where it would be dropped */
  items: T[];
  /** Where to show a placeholder for an item dragged in from another list */
  placeholderIndex: number | null;
  placeholderSize: { width: number; height: number } | null;
  /** Key of this list's item that is being dragged */
  draggingKey: string | null;
}

const noopSubscribe = () => () => {};
const getNull = () => null;

/**
 * How a rows or tabs list should render while a row or tab is dragged. Only changes when the drop
 * target changes, not on every pointer move.
 */
export function useListDragPreview<T extends { state: { key?: string } }>(
  orchestrator: DashboardLayoutOrchestrator | undefined,
  listKey: string | undefined,
  items: T[]
): ListDragPreview<T> {
  const drag = useSyncExternalStore(
    orchestrator?.subscribeToListDrag ?? noopSubscribe,
    orchestrator?.getListDragState ?? getNull
  );
  return getListDragPreview(drag, listKey, items);
}

export function useIsListItemDragging(
  orchestrator: DashboardLayoutOrchestrator | undefined,
  itemKey: string | undefined
): boolean {
  return useSyncExternalStore(orchestrator?.subscribeToListDrag ?? noopSubscribe, () => {
    const drag = orchestrator?.getListDragState();
    return !!drag && !!itemKey && drag.itemKey === itemKey;
  });
}

/** Pointer downs on controls inside a row header should not start dragging the row */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, input, textarea, select, a[href], [role="button"]');
}

export function getListDragPreview<T extends { state: { key?: string } }>(
  drag: ListDragState | null,
  listKey: string | undefined,
  items: T[]
): ListDragPreview<T> {
  const none = { items, placeholderIndex: null, placeholderSize: null, draggingKey: null };
  if (!drag || !listKey) {
    return none;
  }

  const isSource = drag.sourceListKey === listKey;
  const draggingKey = isSource ? drag.itemKey : null;
  const target = drag.target;

  if (target?.kind !== 'list' || target.list.state.key !== listKey) {
    return { ...none, draggingKey };
  }

  if (isSource) {
    const dragged = items.find((item) => item.state.key === drag.itemKey);
    if (!dragged) {
      return { ...none, draggingKey };
    }
    const reordered = items.filter((item) => item !== dragged);
    reordered.splice(target.index, 0, dragged);
    return { ...none, items: reordered, draggingKey };
  }

  return { ...none, placeholderIndex: target.index, placeholderSize: drag.placeholderSize };
}

/** Whether a row is being dragged over this tab's content to group it into rows */
export function useIsGroupDropTarget(
  orchestrator: DashboardLayoutOrchestrator | undefined,
  tabKey: string | undefined
): boolean {
  return useSyncExternalStore(orchestrator?.subscribeToListDrag ?? noopSubscribe, () => {
    const target = orchestrator?.getListDragState()?.target;
    return target?.kind === 'group' && !!tabKey && target.tab.state.key === tabKey;
  });
}
