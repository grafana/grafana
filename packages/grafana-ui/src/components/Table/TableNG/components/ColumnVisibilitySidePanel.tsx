import { css } from '@emotion/css';
import memoize from 'micro-memoize';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Checkbox } from '../../../Forms/Checkbox';
import { IconButton } from '../../../IconButton/IconButton';
import { TABLE } from '../constants';
import { getGridBackgroundColor } from '../styles';

const sidebarSelectors = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

export interface SidebarColumn {
  name: string;
  hideable: boolean;
}

interface ColumnVisibilitySidePanelProps {
  /** All columns in display order, including hidden columns. */
  columns: SidebarColumn[];
  hiddenColumns: ReadonlySet<string>;
  onToggleColumn: (displayName: string, visible: boolean) => void;
  onClose: () => void;
  headerHeight?: number;
  transparent?: boolean;
  /** Whether releasing the splitter will close the panel. */
  willCloseOnRelease?: boolean;
}

export function ColumnVisibilitySidePanel({
  columns,
  hiddenColumns,
  onToggleColumn,
  onClose,
  headerHeight = TABLE.HEADER_HEIGHT,
  transparent,
  willCloseOnRelease = false,
}: ColumnVisibilitySidePanelProps) {
  const styles = useStyles2(getStyles, transparent, headerHeight);
  const visibleCount = columns.filter(({ name }) => !hiddenColumns.has(name)).length;

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
        {columns.map(({ name: displayName, hideable }) => {
          const isVisible = !hiddenColumns.has(displayName);
          const isLastVisible = isVisible && visibleCount <= 1;

          return (
            <div key={displayName} className={styles.row} data-testid={sidebarSelectors.row(displayName)}>
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
                />
              ) : (
                <span className={styles.visibilityTogglePlaceholder} aria-hidden="true" />
              )}
              <span className={styles.columnName}>{displayName}</span>
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
    padding: theme.spacing(0.75, 1, 0.75, 1.5),
    '&:hover': {
      backgroundColor: theme.components.table.rowHoverBackground,
    },
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
