import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { type ReactNode, useId, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Checkbox } from '../../../Forms/Checkbox';
import { Icon } from '../../../Icon/Icon';
import { IconButton } from '../../../IconButton/IconButton';
import { Stack } from '../../../Layout/Stack/Stack';
import { TABLE } from '../constants';
import { getGridBackgroundColor } from '../styles';

const sidebarSelectors = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

export interface SidebarColumn {
  name: string;
  hideable: boolean;
}

interface TableSidebarProps {
  settings?: ReactNode;
  settingsActive?: boolean;
  columnsDisabled?: boolean;
  /** All columns in display order, including hidden columns. */
  columns: SidebarColumn[];
  reorderable?: boolean;
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

export function TableSidebar({
  settings,
  settingsActive = false,
  columnsDisabled = false,
  columns,
  reorderable = false,
  hiddenColumns,
  pinnedColumns,
  onToggleColumn,
  onTogglePin,
  onColumnsReorder,
  onClose,
  headerHeight = TABLE.HEADER_HEIGHT,
  transparent,
  willCloseOnRelease = false,
}: TableSidebarProps) {
  const styles = useStyles2(getStyles, transparent, headerHeight);
  const settingsId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const visibleCount = columns.filter(({ name }) => !hiddenColumns.has(name)).length;

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  return (
    // A complementary landmark cannot be nested inside the page's main landmark.
    <div
      role="group"
      className={css(styles.container, willCloseOnRelease && styles.containerWillClose)}
      aria-label={t('grafana-ui.table.column-visibility', 'Column visibility')}
      data-testid={sidebarSelectors.container}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div className={styles.header}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0} height="100%">
          <span className={styles.heading}>
            <Trans i18nKey="grafana-ui.table.columns">Columns</Trans>
          </span>
          <Stack direction="row" alignItems="center" gap={0.5}>
            {settings && (
              <IconButton
                name="cog"
                size="sm"
                variant={settingsActive ? 'primary' : 'secondary'}
                aria-label={t('grafana-ui.table.column-settings', 'Column settings')}
                aria-expanded={settingsOpen}
                aria-controls={settingsId}
                data-testid={sidebarSelectors.settingsButton}
                onClick={() => setSettingsOpen((open) => !open)}
              />
            )}
            <IconButton
              name="times"
              size="sm"
              aria-label={t('grafana-ui.table.close-column-visibility', 'Close column visibility panel')}
              onClick={onClose}
              data-testid={sidebarSelectors.closeButton}
            />
          </Stack>
        </Stack>
      </div>
      {settings && (
        <div id={settingsId} hidden={!settingsOpen} className={styles.settings}>
          {settings}
        </div>
      )}
      <div className={styles.columnList}>
        {columns.map(({ name: displayName, hideable }) => {
          const isVisible = !hiddenColumns.has(displayName);
          const isLastVisible = isVisible && visibleCount <= 1;

          return (
            <div
              key={displayName}
              className={css(styles.row, dragOverColumn === displayName && styles.rowDragOver)}
              data-testid={sidebarSelectors.row(displayName)}
              onDragOver={(ev) => {
                if (columnsDisabled || !reorderable || draggedColumn == null || draggedColumn === displayName) {
                  return;
                }
                ev.preventDefault();
                setDragOverColumn(displayName);
              }}
              onDragLeave={() => setDragOverColumn((current) => (current === displayName ? null : current))}
              onDrop={(ev) => {
                ev.preventDefault();
                setDragOverColumn(null);
                if (!columnsDisabled && reorderable && draggedColumn != null && draggedColumn !== displayName) {
                  onColumnsReorder(draggedColumn, displayName);
                }
              }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                {reorderable && (
                  <button
                    type="button"
                    className={styles.dragHandle}
                    draggable={!columnsDisabled}
                    disabled={columnsDisabled}
                    aria-label={t('grafana-ui.table.reorder-column-label', 'Reorder {{columnName}}', {
                      columnName: displayName,
                    })}
                    onDragStart={(ev) => {
                      ev.dataTransfer.effectAllowed = 'move';
                      ev.dataTransfer.setData('text/plain', displayName);
                      setDraggedColumn(displayName);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') {
                        return;
                      }
                      ev.preventDefault();
                      const index = columns.findIndex((column) => column.name === displayName);
                      const target = columns[index + (ev.key === 'ArrowUp' ? -1 : 1)];
                      if (target) {
                        onColumnsReorder(displayName, target.name);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedColumn(null);
                      setDragOverColumn(null);
                    }}
                  >
                    <Icon name="draggabledots" aria-hidden="true" />
                  </button>
                )}
                {hideable ? (
                  <Checkbox
                    value={isVisible}
                    disabled={columnsDisabled || isLastVisible}
                    aria-label={
                      isVisible
                        ? t('grafana-ui.table.hide-column-label', 'Hide {{columnName}}', { columnName: displayName })
                        : t('grafana-ui.table.show-column-label', 'Show {{columnName}}', { columnName: displayName })
                    }
                    onChange={(ev) => onToggleColumn(displayName, ev.currentTarget.checked)}
                  />
                ) : (
                  <span className={styles.visibilityTogglePlaceholder} aria-hidden="true" />
                )}
                <span className={styles.columnName}>{displayName}</span>
                {onTogglePin && !columnsDisabled && (
                  <button
                    type="button"
                    className={styles.pinButton}
                    aria-pressed={pinnedColumns?.has(displayName) ?? false}
                    aria-label={
                      pinnedColumns?.has(displayName)
                        ? t('grafana-ui.table.unpin-column-label', 'Unpin {{columnName}}', { columnName: displayName })
                        : t('grafana-ui.table.pin-column-label', 'Pin {{columnName}}', { columnName: displayName })
                    }
                    onClick={() => onTogglePin(displayName)}
                  >
                    <Icon name="gf-pin" aria-hidden="true" />
                  </button>
                )}
              </Stack>
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
  settings: css({
    padding: theme.spacing(1.5),
    overflowY: 'auto',
    maxHeight: '70%',
    borderBottom: `1px solid ${theme.components.table.border}`,
  }),
  row: css({
    padding: theme.spacing(0.75, 1, 0.75, 1.5),
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
  pinButton: css({
    display: 'flex',
    alignItems: 'center',
    border: 'none',
    background: 'transparent',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&[aria-pressed="true"]': { color: theme.colors.primary.main },
  }),
  // Keep column names aligned when a capability is unavailable.
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
}));
