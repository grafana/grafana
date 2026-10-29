import { css } from '@emotion/css';
import { type DragEvent, type PointerEvent as ReactPointerEvent, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getLayoutOrchestratorFor } from '../../../utils/utils';
import { type DashboardLayoutOrchestrator } from '../../DashboardLayoutOrchestrator';
import { type RowItem } from '../../layout-rows/RowItem';
import { type RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { type TabItem } from '../../layout-tabs/TabItem';
import { type TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';
import { isUnifiedDragAndDropEnabled } from '../unifiedDragAndDrop';

import { type ListDragState } from './ListDragSession';
import { LIST_DROP_KEY_ATTR, LIST_ITEM_KEY_ATTR } from './attributes';
import { type ListItem, type ListLayout } from './listDnd';

export interface RowsListDrag {
  /** Whether rows are dragged on the unified engine, hello-pangea/dnd has to stay inert then */
  isEnabled: boolean;
  /** The rows in the order to render them: a row dragged within the list shows where it would be dropped */
  rows: RowItem[];
  /** Where to show a placeholder for a row dragged in from another list */
  dropPlaceholder: { index: number; height: number } | null;
  /** For the list's element */
  attributes: Record<string, string>;
}

export interface RowDrag {
  /** For the row's element */
  attributes: Record<string, string>;
  /** For the row's element while it is dragged */
  className?: string;
  /** For the row's header, which starts the drag */
  onPointerDown?: (evt: ReactPointerEvent) => void;
}

export interface TabsListDrag {
  /** Whether tabs are dragged on the unified engine, hello-pangea/dnd has to stay inert then */
  isEnabled: boolean;
  /** The tabs in the order to render them: a tab dragged within the tab bar shows where it would be dropped */
  tabs: TabItem[];
  /** Where to show a placeholder for a tab dragged in from another tab bar */
  dropPlaceholder: { index: number; width: number; height: number } | null;
  /** For the tab bar's element */
  attributes: Record<string, string>;
}

export interface TabDrag {
  /** For the tab's element */
  attributes: Record<string, string>;
  /** For the tab's element while it is dragged */
  className?: string;
  /**
   * For the tab's element, which is the drag handle. Capture phase, because the tab header stops the
   * propagation of pointerdown.
   */
  onPointerDownCapture?: (evt: ReactPointerEvent) => void;
  /** The tab header is a link, which the browser would drag as a link otherwise */
  onDragStart?: (evt: DragEvent) => void;
}

const noAttributes = {};
const noopSubscribe = () => () => {};
const getNoDrag = () => null;
const preventDefault = (evt: DragEvent) => evt.preventDefault();

/**
 * How a rows list renders row drags on the unified engine. With the flag off, it returns the rows
 * as they are and hello-pangea/dnd drags them as before.
 */
export function useRowsListDrag(layout: RowsLayoutManager, rows: RowItem[], isEditing: boolean): RowsListDrag {
  const isEnabled = isUnifiedDragAndDropEnabled();
  const drag = useListDragState(isEnabled && isEditing ? getLayoutOrchestratorFor(layout) : undefined);

  if (!isEnabled || !isEditing) {
    return { isEnabled, rows, dropPlaceholder: null, attributes: noAttributes };
  }

  const preview = getListDragPreview(drag, layout, rows);
  return {
    isEnabled,
    rows: preview.items,
    dropPlaceholder: preview.dropPlaceholder,
    attributes: layout.state.key ? { [LIST_DROP_KEY_ATTR]: layout.state.key } : noAttributes,
  };
}

/**
 * How a tab bar renders tab drags on the unified engine. With the flag off, it returns the tabs as
 * they are and hello-pangea/dnd drags them as before.
 */
export function useTabsListDrag(layout: TabsLayoutManager, tabs: TabItem[], isEditing: boolean): TabsListDrag {
  const isEnabled = isUnifiedDragAndDropEnabled();
  const drag = useListDragState(isEnabled && isEditing ? getLayoutOrchestratorFor(layout) : undefined);

  if (!isEnabled || !isEditing) {
    return { isEnabled, tabs, dropPlaceholder: null, attributes: noAttributes };
  }

  const preview = getListDragPreview(drag, layout, tabs);
  return {
    isEnabled,
    tabs: preview.items,
    dropPlaceholder: preview.dropPlaceholder,
    attributes: layout.state.key ? { [LIST_DROP_KEY_ATTR]: layout.state.key } : noAttributes,
  };
}

/**
 * How a row takes part in row drags on the unified engine. Returns nothing with the flag off, then
 * hello-pangea/dnd drags the row as before.
 */
export function useRowDrag(row: RowItem, isDraggable: boolean): RowDrag | undefined {
  const item = useListItemDrag(row);
  if (!item) {
    return undefined;
  }
  const { orchestrator, ...rest } = item;
  return {
    ...rest,
    onPointerDown: isDraggable && orchestrator ? (evt) => orchestrator.startListDrag(evt, row) : undefined,
  };
}

/**
 * How a tab takes part in tab drags on the unified engine. Returns nothing with the flag off, then
 * hello-pangea/dnd drags the tab as before.
 */
export function useTabDrag(tab: TabItem, isDraggable: boolean): TabDrag | undefined {
  const item = useListItemDrag(tab);
  if (!item) {
    return undefined;
  }
  const { orchestrator, ...rest } = item;
  if (!isDraggable || !orchestrator) {
    return rest;
  }
  return {
    ...rest,
    onPointerDownCapture: (evt) => orchestrator.startListDrag(evt, tab),
    onDragStart: preventDefault,
  };
}

function useListItemDrag(item: ListItem) {
  const isEnabled = isUnifiedDragAndDropEnabled();
  const styles = useStyles2(getStyles);
  const orchestrator = isEnabled ? getLayoutOrchestratorFor(item) : undefined;
  // Repeated copies of an item move with it
  const itemKey = item.state.repeatSourceKey ?? item.state.key;
  const isDragging = useSyncExternalStore(orchestrator?.subscribeToListDrag ?? noopSubscribe, () => {
    const drag = orchestrator?.getListDragState();
    return !!drag && drag.itemKey === itemKey;
  });

  if (!isEnabled) {
    return undefined;
  }

  return {
    orchestrator,
    attributes: itemKey ? { [LIST_ITEM_KEY_ATTR]: itemKey } : noAttributes,
    className: isDragging ? styles.dragging : undefined,
  };
}

function useListDragState(orchestrator: DashboardLayoutOrchestrator | undefined): ListDragState | null {
  return useSyncExternalStore(
    orchestrator?.subscribeToListDrag ?? noopSubscribe,
    orchestrator?.getListDragState ?? getNoDrag
  );
}

/** The list's items in the order to render them, and where a placeholder goes, during a drag */
function getListDragPreview<T extends ListItem>(
  drag: ListDragState | null,
  list: ListLayout,
  items: T[]
): { items: T[]; dropPlaceholder: { index: number; width: number; height: number } | null } {
  const target = drag?.target;
  const listKey = list.state.key;
  if (!drag || !listKey || target?.kind !== 'list' || target.list.state.key !== listKey) {
    return { items, dropPlaceholder: null };
  }

  if (drag.sourceListKey !== listKey) {
    return {
      items,
      dropPlaceholder: { index: target.index, width: drag.placeholderWidth, height: drag.placeholderHeight },
    };
  }

  const dragged = items.find((item) => item.state.key === drag.itemKey);
  if (!dragged) {
    return { items, dropPlaceholder: null };
  }
  const reordered = items.filter((item) => item !== dragged);
  reordered.splice(target.index, 0, dragged);
  return { items: reordered, dropPlaceholder: null };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    dragging: css({
      opacity: 0.5,
      outline: `1px dashed ${theme.colors.primary.border}`,
      borderRadius: theme.shape.radius.default,
    }),
  };
}
