import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Checkbox } from '../../../Forms/Checkbox';
import { Icon } from '../../../Icon/Icon';
import { IconButton } from '../../../IconButton/IconButton';
import { TABLE } from '../constants';
import { getGridBackgroundColor } from '../styles';

const sidebarSelectors = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

const NO_PINNED_COLUMNS: ReadonlySet<string> = new Set();

export interface SidebarColumn {
  name: string;
  reorderable: boolean;
  hideable: boolean;
}

interface ColumnVisibilitySidePanelProps {
  /** All columns in display order, including hidden columns. */
  columns: SidebarColumn[];
  hiddenColumns: ReadonlySet<string>;
  pinnedColumns?: ReadonlySet<string>;
  onToggleColumn: (displayName: string, visible: boolean) => void;
  onTogglePin?: (displayName: string) => void;
  onColumnsReorder: (sourceColumnKey: string, targetColumnKey: string) => void;
  onClose: () => void;
  headerHeight?: number;
  transparent?: boolean;
  /** Whether releasing the splitter will close the panel. */
  willCloseOnRelease?: boolean;
}

export function ColumnVisibilitySidePanel({
  columns,
  hiddenColumns,
  pinnedColumns = NO_PINNED_COLUMNS,
  onToggleColumn,
  onTogglePin,
  onColumnsReorder,
  onClose,
  headerHeight = TABLE.HEADER_HEIGHT,
  transparent,
  willCloseOnRelease = false,
}: ColumnVisibilitySidePanelProps) {
  const styles = useStyles2(getStyles, transparent, headerHeight);
  const visibleCount = columns.length - hiddenColumns.size;

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  return (
    // A complementary landmark cannot be nested inside the page's main landmark.
    <div
      role="group"
      className={css(styles.container, willCloseOnRelease && styles.containerWillClose)}
      aria-label={t('grafana-ui.table.column-visibility', 'Column visibility')}
      data-testid={sidebarSelectors.container}
    >
      <div className={styles.header}>
        <span className={styles.heading}>
          <Trans i18nKey="grafana-ui.table.columns">Columns</Trans>
        </span>
        <IconButton
          name="times"
          size="sm"
          aria-label={t('grafana-ui.table.close-column-visibility', 'Close column visibility panel')}
          onClick={onClose}
          data-testid={sidebarSelectors.closeButton}
        />
      </div>
      <div className={styles.columnList}>
        {columns.map(({ name: displayName, reorderable, hideable }) => {
          const isVisible = !hiddenColumns.has(displayName);
          const isPinned = pinnedColumns.has(displayName);
          const isLastVisible = isVisible && visibleCount <= 1;
          const isOverBoundary =
            draggedColumn != null && draggedColumn !== displayName && pinnedColumns.has(draggedColumn) !== isPinned;

          return (
            <div
              key={displayName}
              className={css(styles.row, dragOverColumn === displayName && !isOverBoundary && styles.rowDragOver)}
              data-testid={sidebarSelectors.row(displayName)}
              onDragOver={(ev) => {
                if (!reorderable || draggedColumn == null || draggedColumn === displayName || isOverBoundary) {
                  return;
                }
                ev.preventDefault();
                setDragOverColumn(displayName);
              }}
              onDragLeave={() => setDragOverColumn((current) => (current === displayName ? null : current))}
              onDrop={(ev) => {
                ev.preventDefault();
                setDragOverColumn(null);
                if (reorderable && draggedColumn != null && draggedColumn !== displayName && !isOverBoundary) {
                  onColumnsReorder(draggedColumn, displayName);
                }
              }}
            >
              {reorderable ? (
                <button
                  type="button"
                  className={styles.dragHandle}
                  draggable
                  aria-label={t('grafana-ui.table.reorder-column-label', 'Reorder {{columnName}}', {
                    columnName: displayName,
                  })}
                  data-testid={sidebarSelectors.dragHandle(displayName)}
                  onDragStart={(ev) => {
                    ev.dataTransfer.effectAllowed = 'move';
                    setDraggedColumn(displayName);
                  }}
                  onDragEnd={() => {
                    setDraggedColumn(null);
                    setDragOverColumn(null);
                  }}
                >
                  <Icon name="draggabledots" aria-hidden="true" />
                </button>
              ) : (
                <span className={styles.dragHandlePlaceholder} aria-hidden="true" />
              )}
              {hideable ? (
                <Checkbox
                  value={isVisible}
                  disabled={isLastVisible}
                  aria-label={
                    isVisible
                      ? t('grafana-ui.table.hide-column-label', 'Hide {{columnName}}', { columnName: displayName })
                      : t('grafana-ui.table.show-column-label', 'Show {{columnName}}', { columnName: displayName })
                  }
                  onChange={(ev) => onToggleColumn(displayName, ev.currentTarget.checked)}
                  data-testid={sidebarSelectors.visibilityToggle(displayName)}
                />
              ) : (
                <span className={styles.visibilityTogglePlaceholder} aria-hidden="true" />
              )}
              <span className={styles.columnName}>{displayName}</span>
              {onTogglePin && (
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const getStyles = memoize((theme: GrafanaTheme2, transparent: boolean | undefined, headerHeight: number) => ({
  container: css({
    label: 'columnVisibilitySidePanel',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    // The parent pane clips this min-content layout while closing.
    minWidth: 'min-content',
    overflow: 'hidden',
    backgroundColor: getGridBackgroundColor(theme, transparent),
    borderTopRightRadius: theme.shape.radius.default,
    borderInlineEnd: `1px solid ${theme.components.table.border}`,
    '> *': {
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shortest }),
      },
    },
  }),
  containerWillClose: css({
    '> *': {
      opacity: 0.5,
    },
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    height: headerHeight,
    flexShrink: 0,
    padding: theme.spacing(1, 1, 1, 1.5),
    backgroundColor: theme.components.table.headerBackground,
    borderBottom: `1px solid ${theme.components.table.border}`,
  }),
  heading: css({
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
    display: 'block',
    height: theme.spacing(2),
    lineHeight: theme.spacing(2),
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
    // Prevent text selection from stealing the native drag gesture.
    userSelect: 'none',
    '&:hover': {
      backgroundColor: theme.components.table.rowHoverBackground,
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
  // Keep column names aligned when a capability is unavailable.
  dragHandlePlaceholder: css({
    display: 'flex',
    width: theme.spacing(2),
  }),
  visibilityTogglePlaceholder: css({
    display: 'flex',
    width: theme.spacing(2),
  }),
  columnName: css({
    flex: 1,
    fontSize: theme.typography.bodySmall.fontSize,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    userSelect: 'none',
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
      color: theme.colors.warning.text,
    },
  }),
}));
