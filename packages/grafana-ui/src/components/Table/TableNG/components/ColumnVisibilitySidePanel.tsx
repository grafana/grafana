import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import {
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Checkbox } from '../../../Forms/Checkbox';
import { Icon } from '../../../Icon/Icon';
import { getDisplayName } from '../utils';

export const COLUMN_VISIBILITY_RAIL_WIDTH = 3;
export const COLUMN_VISIBILITY_PANEL_MIN_WIDTH = 160;
export const COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH = 240;
export const COLUMN_VISIBILITY_PANEL_MAX_WIDTH = 400;

interface ColumnVisibilitySidePanelProps {
  fields: Field[];
  hiddenColumns: ReadonlySet<string>;
  pinnedColumns: ReadonlySet<string>;
  isOpen: boolean;
  width: number;
  maxWidth: number;
  onOpenChange: (isOpen: boolean) => void;
  onWidthChange: (width: number) => void;
  onToggleColumn: (displayName: string, visible: boolean) => void;
  onTogglePin: (displayName: string) => void;
  onColumnsReorder: (sourceColumn: string, targetColumn: string) => void;
}

interface DragState {
  startX: number;
  startWidth: number;
  moved: boolean;
}

const DRAG_THRESHOLD = 3;
const KEYBOARD_RESIZE_STEP = 16;
const COLUMN_REORDER_ANIMATION_MS = 220;

export function ColumnVisibilitySidePanel({
  fields,
  hiddenColumns,
  pinnedColumns,
  isOpen,
  width,
  maxWidth,
  onOpenChange,
  onWidthChange,
  onToggleColumn,
  onTogglePin,
  onColumnsReorder,
}: ColumnVisibilitySidePanelProps) {
  const styles = useStyles2(getStyles);
  const panelId = useId();
  const dragState = useRef<DragState>();
  const suppressClick = useRef(false);
  const columnRows = useRef(new Map<string, HTMLDivElement>());
  const previousColumnPositions = useRef(new Map<string, number>());
  const [draggedColumn, setDraggedColumn] = useState<string>();
  const [dragOverColumn, setDragOverColumn] = useState<string>();
  const visibleCount = fields.length - hiddenColumns.size;
  const effectiveMaxWidth = Math.max(COLUMN_VISIBILITY_PANEL_MIN_WIDTH, maxWidth);
  const clampWidth = (nextWidth: number) =>
    Math.max(COLUMN_VISIBILITY_PANEL_MIN_WIDTH, Math.min(nextWidth, effectiveMaxWidth));

  useLayoutEffect(() => {
    const nextPositions = new Map<string, number>();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    for (const [displayName, row] of columnRows.current) {
      const nextTop = row.getBoundingClientRect().top;
      nextPositions.set(displayName, nextTop);
      const previousTop = previousColumnPositions.current.get(displayName);
      const offset = previousTop == null ? 0 : previousTop - nextTop;

      if (!reduceMotion && offset !== 0 && typeof row.animate === 'function') {
        row.animate([{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }], {
          duration: COLUMN_REORDER_ANIMATION_MS,
          easing: 'ease-out',
        });
      }
    }

    previousColumnPositions.current = nextPositions;
  });

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragState.current = {
      startX: event.clientX,
      startWidth: isOpen ? width : 0,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragState.current;
    if (!drag) {
      return;
    }

    const delta = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(delta) <= DRAG_THRESHOLD) {
      return;
    }

    drag.moved = true;
    suppressClick.current = true;
    onOpenChange(true);
    onWidthChange(clampWidth(drag.startWidth + delta));
  };

  const finishPointerInteraction = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current) {
      return;
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    dragState.current = undefined;
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onOpenChange(!isOpen);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenChange(!isOpen);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      onOpenChange(true);
      onWidthChange(effectiveMaxWidth);
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    onOpenChange(true);
    onWidthChange(
      clampWidth(
        (isOpen ? width : COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH) +
          (event.key === 'ArrowLeft' ? -1 : 1) * KEYBOARD_RESIZE_STEP
      )
    );
  };

  const handleColumnDragStart = (event: DragEvent<HTMLButtonElement>, displayName: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', displayName);
    setDraggedColumn(displayName);
  };

  const handleColumnDragOver = (event: DragEvent<HTMLDivElement>, displayName: string) => {
    if (
      !draggedColumn ||
      draggedColumn === displayName ||
      pinnedColumns.has(draggedColumn) !== pinnedColumns.has(displayName)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverColumn(displayName);
  };

  const handleColumnDrop = (event: DragEvent<HTMLDivElement>, displayName: string) => {
    event.preventDefault();
    if (
      draggedColumn &&
      draggedColumn !== displayName &&
      pinnedColumns.has(draggedColumn) === pinnedColumns.has(displayName)
    ) {
      onColumnsReorder(draggedColumn, displayName);
    }
    setDraggedColumn(undefined);
    setDragOverColumn(undefined);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(undefined);
    setDragOverColumn(undefined);
  };

  return (
    <aside
      className={styles.container}
      style={{ width: isOpen ? width : COLUMN_VISIBILITY_RAIL_WIDTH }}
      aria-label={t('grafana-ui.table.column-visibility', 'Column visibility')}
    >
      {isOpen && (
        <div id={panelId} className={styles.panel}>
          <h3 className={styles.heading}>
            <Trans i18nKey="grafana-ui.table.columns">Columns</Trans>
          </h3>
          <div className={styles.columnList}>
            {fields.map((field) => {
              const displayName = getDisplayName(field);
              const isVisible = !hiddenColumns.has(displayName);
              const isPinned = pinnedColumns.has(displayName);
              const isLastVisible = isVisible && visibleCount <= 1;
              const visibilityLabel = isVisible
                ? t('grafana-ui.table.hide-column-label', 'Hide {{columnName}}', { columnName: displayName })
                : t('grafana-ui.table.show-column-label', 'Show {{columnName}}', { columnName: displayName });
              const pinLabel = isPinned
                ? t('grafana-ui.table.unpin-column-label', 'Unpin {{columnName}}', { columnName: displayName })
                : t('grafana-ui.table.pin-column-label', 'Pin {{columnName}}', { columnName: displayName });

              return (
                <div
                  key={displayName}
                  ref={(element) => {
                    if (element) {
                      columnRows.current.set(displayName, element);
                    } else {
                      columnRows.current.delete(displayName);
                    }
                  }}
                  className={clsx(
                    styles.columnRow,
                    draggedColumn === displayName && styles.draggingColumn,
                    dragOverColumn === displayName && styles.dragOverColumn
                  )}
                  onDragOver={(event) => handleColumnDragOver(event, displayName)}
                  onDragLeave={() => setDragOverColumn((current) => (current === displayName ? undefined : current))}
                  onDrop={(event) => handleColumnDrop(event, displayName)}
                >
                  <button
                    type="button"
                    className={styles.dragHandle}
                    data-column-drag-handle
                    draggable
                    aria-label={t('grafana-ui.table.reorder-column-label', 'Reorder {{columnName}}', {
                      columnName: displayName,
                    })}
                    onDragStart={(event) => handleColumnDragStart(event, displayName)}
                    onDragEnd={handleColumnDragEnd}
                  >
                    <Icon name="draggabledots" aria-hidden="true" />
                  </button>
                  <Checkbox
                    value={isVisible}
                    aria-label={visibilityLabel}
                    disabled={isLastVisible}
                    onChange={(event) => onToggleColumn(displayName, event.currentTarget.checked)}
                  />
                  <span className={styles.columnName}>{displayName}</span>
                  <button
                    type="button"
                    className={styles.pinButton}
                    aria-label={pinLabel}
                    aria-pressed={isPinned}
                    onClick={() => onTogglePin(displayName)}
                  >
                    <Icon name="gf-pin" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        className={styles.railHandle}
        aria-label={t('grafana-ui.table.column-visibility-resizer', 'Column visibility panel')}
        aria-controls={isOpen ? panelId : undefined}
        aria-expanded={isOpen}
        title={t(
          'grafana-ui.table.column-visibility-resizer-instructions',
          'Click to open or close. Drag or use arrow keys to resize.'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
      />
    </aside>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  container: css({
    label: 'columnVisibilitySidePanel',
    position: 'relative',
    flex: '0 0 auto',
    minWidth: COLUMN_VISIBILITY_RAIL_WIDTH,
    height: '100%',
    background: theme.colors.background.primary,
  }),
  panel: css({
    label: 'columnVisibilityPanel',
    height: '100%',
    overflow: 'hidden',
    background: theme.colors.background.secondary,
    padding: theme.spacing(1),
    paddingInlineEnd: theme.spacing(1.5),
  }),
  heading: css({
    margin: theme.spacing(0, 0, 1),
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  columnList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    maxHeight: 'calc(100% - 28px)',
    overflowY: 'auto',
  }),
  columnRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    minHeight: 32,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.action.hover,
    },
    '&:hover [data-column-drag-handle], &:focus-within [data-column-drag-handle]': {
      opacity: 1,
    },
  }),
  draggingColumn: css({
    opacity: 0.5,
  }),
  dragOverColumn: css({
    boxShadow: `inset 0 2px 0 ${theme.colors.primary.main}`,
  }),
  dragHandle: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: 16,
    height: 24,
    marginInlineStart: -4,
    padding: 0,
    color: theme.colors.text.secondary,
    background: 'transparent',
    border: 0,
    cursor: 'grab',
    opacity: 0,
    '&:active': {
      cursor: 'grabbing',
    },
    '&:focus-visible': {
      opacity: 1,
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: -2,
    },
  }),
  columnName: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#9299a2',
    fontSize: 12,
  }),
  pinButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: 24,
    height: 24,
    padding: 0,
    color: theme.colors.text.secondary,
    background: 'transparent',
    border: 0,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    '&[aria-pressed="true"]': {
      color: theme.colors.primary.text,
      background: theme.colors.primary.transparent,
    },
    '&:hover': {
      color: theme.colors.text.primary,
      background: theme.colors.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: -2,
    },
  }),
  railHandle: css({
    label: 'columnVisibilityRail',
    position: 'absolute',
    zIndex: theme.zIndex.tooltip,
    insetBlockStart: '50%',
    insetInlineEnd: -6,
    width: 15,
    height: 128,
    transform: 'translateY(-50%)',
    cursor: 'ew-resize',
    touchAction: 'none',
    padding: 0,
    border: 0,
    background: 'transparent',
    outline: 'none',
    '&::before': {
      content: '""',
      position: 'absolute',
      insetBlock: 0,
      insetInlineStart: 6,
      width: COLUMN_VISIBILITY_RAIL_WIDTH,
      background: '#f59e4b',
    },
    '&:hover::before, &:focus-visible::before': {
      filter: 'brightness(1.1)',
    },
    '&:focus-visible': {
      boxShadow: `inset 0 0 0 2px ${theme.colors.primary.main}`,
    },
  }),
}));
