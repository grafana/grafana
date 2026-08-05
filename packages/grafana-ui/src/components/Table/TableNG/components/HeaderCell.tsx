import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import React, { useEffect, useRef } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Column, type SortDirection } from '@grafana/react-data-grid';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { getFieldTypeIcon } from '../../../../types/icon';
import { Icon } from '../../../Icon/Icon';
import { IconButton } from '../../../IconButton/IconButton';
import { Stack } from '../../../Layout/Stack/Stack';
import { Filter } from '../Filter/Filter';
import { getJustifyContent } from '../styles';
import { type FilterType, type TableRow, type TableSummaryRow } from '../types';
import { getAlignment, getDisplayName } from '../utils';

import { HeaderColumnMenu } from './HeaderColumnMenu';

interface HeaderCellContainerProps {
  column: Column<TableRow, TableSummaryRow>;
  /** Kept for call-site compatibility; label alignment is handled inside HeaderCell. */
  field?: Field;
  children: React.ReactNode;
}

/** Full-width header shell: label alignment is handled by children; trailing actions stay right. */
export function HeaderCellContainer({ column, children }: HeaderCellContainerProps) {
  const columnWidth = typeof column.width === 'number' ? `${column.width}px` : undefined;

  return (
    <div
      data-table-ng-header-cell=""
      style={{
        flex: 1,
        width: '100%',
        minWidth: columnWidth,
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 4,
        minHeight: 0,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
}

interface HeaderCellProps {
  column: Column<TableRow, TableSummaryRow>;
  rows: TableRow[];
  field: Field;
  direction?: SortDirection;
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  showTypeIcons?: boolean;
  selectFirstCell: () => void;
  disableKeyboardEvents?: boolean;
  parentIndex?: number;
  crossFilterRows: Record<string, TableRow[]>;
  crossFilterTailRows: TableRow[];
  onHideColumn?: () => void;
  canHideColumn?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onGroupByColumn?: () => void;
  onUngroup?: () => void;
}

export const HeaderCell: React.FC<HeaderCellProps> = ({
  column,
  direction,
  disableKeyboardEvents,
  field,
  filter,
  rows,
  selectFirstCell,
  setFilter,
  showTypeIcons,
  parentIndex,
  crossFilterRows,
  crossFilterTailRows,
  onHideColumn,
  canHideColumn = true,
  isPinned = false,
  onTogglePin,
  onGroupByColumn,
  onUngroup,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const headerCellWrap = field.config.custom?.wrapHeaderText ?? false;
  const styles = useStyles2(getStyles, headerCellWrap);
  const displayName = getDisplayName(field);
  const filterable = field.config.custom?.filterable ?? false;
  const textAlign = getAlignment(field);
  const justifyContent = getJustifyContent(textAlign);

  // we have to remove/reset the filter if the column is not filterable
  useEffect(() => {
    if (!filterable && filter[displayName]) {
      setFilter((filter: FilterType) => {
        const newFilter = { ...filter };
        delete newFilter[displayName];
        return newFilter;
      });
    }
  }, [filterable, displayName, filter, setFilter]);

  /* eslint-disable jsx-a11y/no-static-element-interactions */
  return (
    <div
      ref={ref}
      className={styles.headerCellRoot}
      onKeyDown={
        disableKeyboardEvents
          ? undefined
          : (ev) => {
              // unfortunately, react-data-grid's default keyboard behavior is not compatible with what we need
              // to do to make filter and sort keyboard accessible, so we have to stop the propagation of events here,
              // and add a way to "hook back in" to their behavior once you've reached the last tabbable element in the last header cell.
              ev.stopPropagation();

              if (!(ev.key === 'Tab' && !ev.shiftKey)) {
                return;
              }

              const tableTabbedElement = ev.target;
              if (!(tableTabbedElement instanceof HTMLElement)) {
                return;
              }

              const headerContent = ref.current;
              const headerCell = ref.current?.parentNode?.parentNode;
              const row = headerCell?.parentNode;
              const isLastElementInHeader =
                headerContent?.lastElementChild?.contains(tableTabbedElement) && headerCell === row?.lastElementChild;

              if (isLastElementInHeader) {
                selectFirstCell();
              }
            }
      }
    >
      <div className={styles.headerCellContent}>
        <Stack direction="row" gap={0.5} alignItems="center" justifyContent={justifyContent} width="100%">
          {showTypeIcons && (
            <Icon className={styles.headerCellIcon} name={getFieldTypeIcon(field)} title={field?.type} size="sm" />
          )}
          <span className={clsx(styles.headerCellLabel, 'table-ng-header-label')} title={displayName}>
            {displayName}
            {direction && (
              <Icon
                className={styles.headerCellIcon}
                size="lg"
                name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'}
              />
            )}
          </span>
        </Stack>
      </div>

      {(filterable || onHideColumn || onTogglePin || onGroupByColumn || onUngroup) && (
        <div className={styles.headerCellActions}>
          {filterable && (
            <Filter
              name={column.key}
              rows={rows}
              filter={filter}
              setFilter={setFilter}
              field={field}
              iconClassName={styles.headerCellIcon}
              parentIndex={parentIndex}
              crossFilterRows={crossFilterRows}
              crossFilterTailRows={crossFilterTailRows}
            />
          )}

          {(onHideColumn || onGroupByColumn) && (
            <HeaderColumnMenu
              displayName={displayName}
              onHideColumn={onHideColumn}
              canHideColumn={canHideColumn}
              isPinned={isPinned}
              onTogglePin={onTogglePin}
              onGroupByColumn={onGroupByColumn}
            />
          )}
          {onUngroup && (
            <IconButton
              className={styles.ungroupButton}
              name="layers-slash"
              size="sm"
              tooltip={t('grafana-ui.table.ungroup-column', 'Ungroup {{name}}', { name: displayName })}
              aria-label={t('grafana-ui.table.ungroup-column', 'Ungroup {{name}}', { name: displayName })}
              onClick={(event) => {
                event.stopPropagation();
                onUngroup();
              }}
              onMouseDown={(event) => event.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
};

const getStyles = memoize((theme: GrafanaTheme2, headerTextWrap?: boolean) => ({
  headerCellRoot: css({
    label: 'headerCellRoot',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    pointerEvents: 'none',
  }),
  headerCellContent: css({
    label: 'headerCellContent',
    pointerEvents: 'none',
    flex: 1,
    minWidth: 0,
  }),
  headerCellActions: css({
    label: 'headerCellActions',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    flexShrink: 0,
    marginLeft: 'auto',
    pointerEvents: 'auto',
  }),
  ungroupButton: css({
    marginRight: 6,
  }),
  headerCellLabel: css({
    label: 'headerCellLabel',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: headerTextWrap ? 'pre-line' : 'nowrap',
    lineHeight: '20px',
    pointerEvents: 'none',
    '&::selection': {
      backgroundColor: 'var(--rdg-background-color)',
      color: theme.colors.text.secondary,
    },
  }),
  headerCellIcon: css({
    color: theme.colors.text.secondary,
    pointerEvents: 'none',
  }),
}));
