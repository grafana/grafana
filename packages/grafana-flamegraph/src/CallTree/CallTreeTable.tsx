import { css, cx } from '@emotion/css';
import { useEffect, type CSSProperties } from 'react';
import {
  type Row,
  type HeaderGroup,
  type TablePropGetter,
  type TableBodyPropGetter,
  type TableProps,
  type TableBodyProps,
} from 'react-table';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { type CallTreeNode } from './utils';

type CallTreeTableProps = {
  width: number;
  height: number;
  compactModeThreshold: number;
  isCompact: boolean;
  setIsCompact: (compact: boolean) => void;
  getFunctionColumnWidth: (availableWidth: number, compactMode: boolean) => number | undefined;
  getTableProps: (propGetter?: TablePropGetter<CallTreeNode>) => TableProps;
  getTableBodyProps: (propGetter?: TableBodyPropGetter<CallTreeNode>) => TableBodyProps;
  headerGroups: Array<HeaderGroup<CallTreeNode>>;
  rows: Array<Row<CallTreeNode>>;
  prepareRow: (row: Row<CallTreeNode>) => void;
  currentSearchMatchId?: string;
  searchMatchRowRef: (node: HTMLTableRowElement | null) => void;
  scrollContainerRef: { current: HTMLDivElement | null };
  focusedNodeId?: string;
  callersNodeLabel?: string;
};

export function CallTreeTable({
  width,
  height,
  compactModeThreshold,
  isCompact,
  setIsCompact,
  getFunctionColumnWidth,
  getTableProps,
  getTableBodyProps,
  headerGroups,
  rows,
  prepareRow,
  currentSearchMatchId,
  searchMatchRowRef,
  scrollContainerRef,
  focusedNodeId,
  callersNodeLabel,
}: CallTreeTableProps) {
  const styles = useStyles2(getStyles);
  const SCROLLBAR_WIDTH = 16;
  const availableWidth = width - SCROLLBAR_WIDTH;
  const shouldBeCompact = availableWidth > 0 && availableWidth < compactModeThreshold;

  useEffect(() => {
    if (availableWidth <= 0) {
      return;
    }
    if (shouldBeCompact !== isCompact) {
      setIsCompact(shouldBeCompact);
    }
  }, [availableWidth, shouldBeCompact, isCompact, setIsCompact]);

  const functionColumnMinWidth = getFunctionColumnWidth(availableWidth, isCompact);

  if (width < 3 || height < 3) {
    return null;
  }

  return (
    <div
      ref={scrollContainerRef}
      data-testid="call-tree-scroll-container"
      className={styles.scrollContainer}
      style={{ width, height, overflow: 'auto' }}
    >
      <table {...getTableProps()} className={styles.table}>
        <thead className={styles.thead}>
          {headerGroups.map((headerGroup) => {
            const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
            return (
              <tr key={key} {...headerGroupProps}>
                {headerGroup.headers.map((column) => {
                  const { key: headerKey, ...headerProps } = column.getHeaderProps(column.getSortByToggleProps());
                  return (
                    <th
                      key={headerKey}
                      {...headerProps}
                      className={styles.th}
                      style={getColumnStyle(column.id, functionColumnMinWidth, column.width, column.minWidth)}
                    >
                      {column.render('Header')}
                      {column.isSorted && (
                        <Icon
                          name={column.isSortedDesc ? 'arrow-down' : 'arrow-up'}
                          size="lg"
                          className={styles.sortIcon}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            );
          })}
        </thead>
        <tbody {...getTableBodyProps()} className={styles.tbody}>
          {rows.map((row, rowIndex) => {
            prepareRow(row);
            const { key, ...rowProps } = row.getRowProps();
            const isFocusedRow = row.original.id === focusedNodeId;
            const isCallersTargetRow = callersNodeLabel && row.original.label === callersNodeLabel;
            const isSearchMatchRow = currentSearchMatchId && row.original.id === currentSearchMatchId;

            return (
              <tr
                key={key}
                {...rowProps}
                ref={isSearchMatchRow ? searchMatchRowRef : null}
                className={cx(
                  styles.tr,
                  (isFocusedRow ||
                    (focusedNodeId?.startsWith('label:') && focusedNodeId.substring(6) === row.original.label)) &&
                    styles.focusedRow,
                  isCallersTargetRow && styles.callersTargetRow,
                  isSearchMatchRow && styles.searchMatchRow
                )}
              >
                {row.cells.map((cell) => {
                  const { key: cellKey, ...cellProps } = cell.getCellProps();
                  const isValueColumn = cell.column.id === 'self' || cell.column.id === 'total';
                  const isActionsColumn = cell.column.id === 'actions';
                  const isLabelColumn = cell.column.id === 'label';
                  return (
                    <td
                      key={cellKey}
                      {...cellProps}
                      className={cx(
                        styles.td,
                        isActionsColumn && styles.actionsColumnCell,
                        isValueColumn && styles.valueColumnCell,
                        isLabelColumn && styles.labelColumnCell
                      )}
                      style={getColumnStyle(
                        cell.column.id,
                        functionColumnMinWidth,
                        cell.column.width,
                        cell.column.minWidth
                      )}
                    >
                      {cell.render('Cell', { rowIndex })}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getColumnStyle(
  columnId: string,
  functionColumnMinWidth: number | undefined,
  columnWidth: number | string | undefined,
  minWidth: number | undefined
): CSSProperties {
  if (columnId === 'label') {
    return {
      ...(functionColumnMinWidth !== undefined
        ? { minWidth: functionColumnMinWidth }
        : minWidth !== undefined && { minWidth }),
      textAlign: 'left',
    };
  }

  return {
    ...(columnWidth !== undefined && { width: columnWidth, maxWidth: columnWidth }),
    ...(minWidth !== undefined && { minWidth }),
    textAlign: columnId === 'self' || columnId === 'total' ? 'right' : undefined,
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    scrollContainer: css({
      '&::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
      },
      '&::-webkit-scrollbar-track': {
        background: theme.colors.background.secondary,
      },
      '&::-webkit-scrollbar-thumb': {
        background: theme.colors.text.disabled,
        borderRadius: theme.shape.radius.default,
      },
      '&::-webkit-scrollbar-thumb:hover': {
        background: theme.colors.text.secondary,
      },
    }),
    table: css({
      // Grow with function names; do not force 100% or a vertical scrollbar
      // creates a few pixels of horizontal overflow.
      width: 'max-content',
      tableLayout: 'auto',
      borderCollapse: 'separate',
      borderSpacing: 0,
      fontSize: theme.typography.fontSize,
      color: theme.colors.text.primary,
    }),
    thead: css({
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.colors.background.secondary,
    }),
    th: css({
      padding: '4px 6px',
      height: '36px',
      textAlign: 'left',
      fontWeight: theme.typography.fontWeightMedium,
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    tbody: css({
      backgroundColor: theme.colors.background.primary,
    }),
    tr: css({
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),
    focusedRow: css({
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.08),
      fontWeight: theme.typography.fontWeightMedium,
      // border-collapse:separate ignores borders on <tr>; draw the marker on the first cell.
      '& > td:first-of-type': {
        boxShadow: `inset 3px 0 0 0 ${theme.colors.primary.main}`,
      },
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
      },
    }),
    callersTargetRow: css({
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.08),
      fontWeight: theme.typography.fontWeightMedium,
      '& > td:first-of-type': {
        boxShadow: `inset 3px 0 0 0 ${theme.colors.info.main}`,
      },
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
      },
    }),
    searchMatchRow: css({
      backgroundColor: theme.colors.warning.transparent,
      fontWeight: theme.typography.fontWeightMedium,
      '& > td:first-of-type': {
        boxShadow: `inset 3px 0 0 0 ${theme.colors.warning.main}`,
      },
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.warning.transparent, 0.1),
      },
    }),
    td: css({
      padding: '0px 6px',
      borderBottom: 'none',
      height: '20px',
      verticalAlign: 'middle',
    }),
    labelColumnCell: css({
      overflow: 'visible',
      whiteSpace: 'nowrap',
    }),
    sortIcon: css({
      marginLeft: theme.spacing(0.5),
    }),
    actionsColumnCell: css({
      overflow: 'hidden',
      backgroundColor: theme.colors.background.secondary,
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
      },
    }),
    valueColumnCell: css({
      overflow: 'visible',
      textAlign: 'right',
    }),
  };
}
