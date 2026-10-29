import { css } from '@emotion/css';
import { type PointerEvent as ReactPointerEvent, useSyncExternalStore } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getLayoutOrchestratorFor } from '../../../utils/utils';
import { type DashboardLayoutOrchestrator } from '../../DashboardLayoutOrchestrator';
import { type RowItem } from '../../layout-rows/RowItem';
import { type RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { isUnifiedDragAndDropEnabled } from '../unifiedDragAndDrop';

import { type ListDragState } from './ListDragSession';
import { LIST_DROP_KEY_ATTR, LIST_ITEM_KEY_ATTR } from './attributes';

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

const noAttributes = {};
const noopSubscribe = () => () => {};
const getNoDrag = () => null;

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

  return {
    isEnabled,
    ...getRowsListDragPreview(drag, layout.state.key, rows),
    attributes: layout.state.key ? { [LIST_DROP_KEY_ATTR]: layout.state.key } : noAttributes,
  };
}

/**
 * How a row takes part in row drags on the unified engine. Returns nothing with the flag off, then
 * hello-pangea/dnd drags the row as before.
 */
export function useRowDrag(row: RowItem, isDraggable: boolean): RowDrag | undefined {
  const isEnabled = isUnifiedDragAndDropEnabled();
  const styles = useStyles2(getStyles);
  const orchestrator = isEnabled ? getLayoutOrchestratorFor(row) : undefined;
  // Repeated copies of a row move with it
  const itemKey = row.state.repeatSourceKey ?? row.state.key;
  const isDragging = useSyncExternalStore(orchestrator?.subscribeToListDrag ?? noopSubscribe, () => {
    const drag = orchestrator?.getListDragState();
    return !!drag && drag.itemKey === itemKey;
  });

  if (!isEnabled) {
    return undefined;
  }

  return {
    attributes: itemKey ? { [LIST_ITEM_KEY_ATTR]: itemKey } : noAttributes,
    className: isDragging ? styles.dragging : undefined,
    onPointerDown: isDraggable && orchestrator ? (evt) => orchestrator.startListDrag(evt, row) : undefined,
  };
}

function useListDragState(orchestrator: DashboardLayoutOrchestrator | undefined): ListDragState | null {
  return useSyncExternalStore(
    orchestrator?.subscribeToListDrag ?? noopSubscribe,
    orchestrator?.getListDragState ?? getNoDrag
  );
}

export function getRowsListDragPreview(
  drag: ListDragState | null,
  listKey: string | undefined,
  rows: RowItem[]
): Pick<RowsListDrag, 'rows' | 'dropPlaceholder'> {
  const target = drag?.target;
  if (!drag || !listKey || target?.kind !== 'list' || target.list.state.key !== listKey) {
    return { rows, dropPlaceholder: null };
  }

  if (drag.sourceListKey !== listKey) {
    return { rows, dropPlaceholder: { index: target.index, height: drag.placeholderHeight } };
  }

  const dragged = rows.find((row) => row.state.key === drag.itemKey);
  if (!dragged) {
    return { rows, dropPlaceholder: null };
  }
  const reordered = rows.filter((row) => row !== dragged);
  reordered.splice(target.index, 0, dragged);
  return { rows: reordered, dropPlaceholder: null };
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
