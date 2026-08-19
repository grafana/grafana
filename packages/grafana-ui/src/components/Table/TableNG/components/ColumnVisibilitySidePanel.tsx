import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useRef, useState } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Checkbox } from '../../../Forms/Checkbox';
import { Icon } from '../../../Icon/Icon';
import { IconButton } from '../../../IconButton/IconButton';
import { getDisplayName } from '../utils';

interface ColumnVisibilitySidePanelProps {
  fields: Field[];
  hiddenColumns: ReadonlySet<string>;
  pinnedColumns: ReadonlySet<string>;
  onToggleColumn: (displayName: string, visible: boolean) => void;
  onTogglePin: (displayName: string) => void;
  onColumnsReorder: (sourceColumnKey: string, targetColumnKey: string) => void;
  onClose: () => void;
}

/**
 * The `table.refresh` sidebar for managing column order, visibility, and pinning all in one place —
 * a complement to the per-column "..." menu, useful once there are more columns than fit
 * comfortably in the header, or for re-showing a column that's been hidden (the menu can only hide
 * one). It has no state of its own for order/hidden/pinned: every control here calls back into the
 * same handlers the header menu uses, so the two stay in sync automatically.
 */
export function ColumnVisibilitySidePanel({
  fields,
  hiddenColumns,
  pinnedColumns,
  onToggleColumn,
  onTogglePin,
  onColumnsReorder,
  onClose,
}: ColumnVisibilitySidePanelProps) {
  const styles = useStyles2(getStyles);
  const visibleCount = fields.length - hiddenColumns.size;

  // Drag state is purely local to the panel's own reorder UI — the reorder itself is delegated to
  // `onColumnsReorder`, the same handler the grid's own header-drag reorder uses.
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragImageRef = useRef<HTMLDivElement>(null);

  return (
    <aside className={styles.container} aria-label={t('grafana-ui.table.column-visibility', 'Column visibility')}>
      <div className={styles.header}>
        <span className={styles.heading}>
          <Trans i18nKey="grafana-ui.table.columns">Columns</Trans>
        </span>
        <IconButton
          name="times"
          size="sm"
          aria-label={t('grafana-ui.table.close-column-visibility', 'Close column visibility panel')}
          onClick={onClose}
        />
      </div>
      <div className={styles.columnList}>
        {fields.map((field) => {
          const displayName = getDisplayName(field);
          const isVisible = !hiddenColumns.has(displayName);
          const isPinned = pinnedColumns.has(displayName);
          const isLastVisible = isVisible && visibleCount <= 1;
          const isOverBoundary =
            draggedColumn != null && draggedColumn !== displayName && pinnedColumns.has(draggedColumn) !== isPinned;

          return (
            <div
              key={displayName}
              className={css(styles.row, dragOverColumn === displayName && !isOverBoundary && styles.rowDragOver)}
              onDragOver={(ev) => {
                if (draggedColumn == null || draggedColumn === displayName || isOverBoundary) {
                  return;
                }
                ev.preventDefault();
                setDragOverColumn(displayName);
              }}
              onDragLeave={() => setDragOverColumn((current) => (current === displayName ? null : current))}
              onDrop={(ev) => {
                ev.preventDefault();
                setDragOverColumn(null);
                if (draggedColumn != null && draggedColumn !== displayName && !isOverBoundary) {
                  onColumnsReorder(draggedColumn, displayName);
                }
              }}
            >
              <button
                type="button"
                className={styles.dragHandle}
                draggable
                aria-label={t('grafana-ui.table.reorder-column-label', 'Reorder {{columnName}}', {
                  columnName: displayName,
                })}
                onDragStart={(ev) => {
                  ev.dataTransfer.effectAllowed = 'move';
                  // No `setData` call — the reorder is entirely internal (`draggedColumn` state
                  // above), so there's no payload for an external drop target to read. Setting one
                  // anyway (e.g. `text/plain`) would let the column name be dropped as plain text
                  // into other apps, which isn't what this handle is for.
                  if (dragImageRef.current) {
                    ev.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
                  }
                  setDraggedColumn(displayName);
                }}
                onDragEnd={() => {
                  setDraggedColumn(null);
                  setDragOverColumn(null);
                }}
              >
                <Icon name="draggabledots" aria-hidden="true" />
              </button>
              <Checkbox
                value={isVisible}
                disabled={isLastVisible}
                aria-label={
                  isVisible
                    ? t('grafana-ui.table.hide-column-label', 'Hide {{columnName}}', { columnName: displayName })
                    : t('grafana-ui.table.show-column-label', 'Show {{columnName}}', { columnName: displayName })
                }
                onChange={(ev) => onToggleColumn(displayName, ev.currentTarget.checked)}
              />
              <span className={styles.columnName}>{displayName}</span>
              <button
                type="button"
                className={styles.pinButton}
                aria-pressed={isPinned}
                aria-label={
                  isPinned
                    ? t('grafana-ui.table.unpin-column-label', 'Unpin {{columnName}}', { columnName: displayName })
                    : t('grafana-ui.table.pin-column-label', 'Pin {{columnName}}', { columnName: displayName })
                }
                onClick={() => onTogglePin(displayName)}
              >
                <Icon name="gf-pin" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      {/* the browser's own default drag image is a full-width, oddly-styled snapshot of the row;
          this one-line placeholder reads better while dragging */}
      <div ref={dragImageRef} className={styles.dragImage} aria-hidden="true" />
    </aside>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  container: css({
    label: 'columnVisibilitySidePanel',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
    borderInlineEnd: `1px solid ${theme.colors.border.weak}`,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1, 1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  heading: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
  }),
  columnList: css({
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flex: 1,
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    // Selectable text under the drag handle competes with the native drag gesture — a mousedown
    // that lands on selectable text starts a text selection instead, same issue as the header
    // cell's own reorder drag.
    userSelect: 'none',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  rowDragOver: css({
    boxShadow: `inset 0 2px 0 0 ${theme.colors.primary.main}`,
  }),
  dragHandle: css({
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'grab',
    color: theme.colors.text.secondary,
    '&:active': {
      cursor: 'grabbing',
    },
  }),
  columnName: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  pinButton: css({
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    '&[aria-pressed="true"]': {
      color: theme.colors.primary.text,
    },
  }),
  dragImage: css({
    position: 'fixed',
    top: '-9999px',
    left: '-9999px',
  }),
}));
