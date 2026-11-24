import { css, cx } from '@emotion/css';
import { useEffect, type ComponentType, type CSSProperties } from 'react';
import {
  type Cell,
  type Row,
  type HeaderGroup,
  type TablePropGetter,
  type TableBodyPropGetter,
  type TableProps,
  type TableBodyProps,
} from 'react-table';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
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
  onRowClick: (row: Row<CallTreeNode>) => void;
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
  onRowClick,
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

  // Minimum width so short names still fill the panel. The column grows past this when a nested
  // name is wider, which is what makes the table scroll sideways.
  const functionColumnMinWidth = getFunctionColumnWidth(availableWidth, isCompact);
  const pinnedRightOffsets = getPinnedRightOffsets(headerGroups);

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
        <thead>
          {headerGroups.map((headerGroup) => {
            const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
            return (
              <tr key={key} {...headerGroupProps}>
                {headerGroup.headers.map((column) => {
                  const { key: headerKey, ...headerProps } = column.getHeaderProps(column.getSortByToggleProps());
                  const pinnedRight = pinnedRightOffsets.get(column.id);
                  return (
                    <th
                      key={headerKey}
                      {...headerProps}
                      className={styles.th}
                      style={getColumnStyle(column, functionColumnMinWidth, pinnedRight)}
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
          {rows.map((row) => {
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
                onClick={({ target, currentTarget }) => {
                  if (target instanceof Element && currentTarget.contains(target) && !target.closest('button')) {
                    onRowClick(row);
                  }
                }}
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
                  const pinnedRight = pinnedRightOffsets.get(cell.column.id);
                  return (
                    <td
                      key={cellKey}
                      {...cellProps}
                      className={cx(
                        styles.td,
                        isActionsColumn && styles.actionsColumnCell,
                        isValueColumn && styles.valueColumnCell,
                        pinnedRight !== undefined && styles.pinnedCell
                      )}
                      style={getColumnStyle(cell.column, functionColumnMinWidth, pinnedRight)}
                    >
                      {renderCell(cell)}
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

function getPinnedRightOffsets(headerGroups: Array<HeaderGroup<CallTreeNode>>): Map<string, number> {
  const offsets = new Map<string, number>();
  const headers = headerGroups[0]?.headers;
  if (!headers) {
    return offsets;
  }

  const labelIndex = headers.findIndex((column) => column.id === 'label');
  if (labelIndex === -1) {
    return offsets;
  }

  let right = 0;
  for (let index = headers.length - 1; index > labelIndex; index--) {
    const column = headers[index];
    offsets.set(column.id, right);
    right += typeof column.width === 'number' ? column.width : (column.minWidth ?? 0);
  }

  return offsets;
}

function getColumnStyle(
  column: { id: string; width?: number | string; minWidth?: number },
  functionColumnMinWidth: number | undefined,
  pinnedRight?: number
): CSSProperties {
  if (column.id === 'label') {
    return {
      ...(functionColumnMinWidth !== undefined && { minWidth: functionColumnMinWidth }),
      width: 'max-content',
      overflow: 'visible',
      whiteSpace: 'nowrap',
      paddingRight: 2,
    };
  }

  return {
    ...(column.width !== undefined && { width: column.width, maxWidth: column.width }),
    ...(column.minWidth !== undefined && { minWidth: column.minWidth }),
    ...(pinnedRight !== undefined && { position: 'sticky', right: pinnedRight }),
    textAlign: column.id === 'self' || column.id === 'total' ? 'right' : undefined,
  };
}

function getStyles(theme: GrafanaTheme2) {
  const background = theme.colors.background.primary;
  // Search paints a translucent warning color. Sticky cells copy the row fill, so flatten it
  // or a scrolled function name shows through the Color Bar, Self, and Total columns.
  const searchFill = colorManipulator.onBackground(theme.colors.warning.transparent, background).toRgbString();
  const searchHoverFill = colorManipulator
    .onBackground(theme.colors.emphasize(theme.colors.warning.transparent, 0.1), background)
    .toRgbString();

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
    // One table so the growing Function column stays aligned with its header. Separate borders keep the
    // header corner radius; row accent stripes are inset shadows because borders on <tr> are dropped.
    table: css({
      width: 'max-content',
      minWidth: '100%',
      tableLayout: 'auto',
      borderCollapse: 'separate',
      borderSpacing: 0,
      fontSize: theme.typography.fontSize,
      color: theme.colors.text.primary,
    }),
    th: css({
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.colors.background.secondary,
      '&:first-of-type': {
        borderStartStartRadius: theme.shape.radius.default,
      },
      '&:last-of-type': {
        borderStartEndRadius: theme.shape.radius.default,
      },
      padding: '4px 6px',
      height: '36px',
      textAlign: 'left',
      fontWeight: theme.typography.fontWeightMedium,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      userSelect: 'none',
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
      },
    }),
    tbody: css({
      backgroundColor: theme.colors.background.primary,
    }),
    tr: css({
      backgroundColor: background,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: colorManipulator.onBackground(theme.colors.action.hover, background).toRgbString(),
      },
    }),
    focusedRow: css({
      backgroundColor: theme.colors.emphasize(background, 0.08),
      fontWeight: theme.typography.fontWeightMedium,
      '& > td:first-of-type': {
        boxShadow: `inset 3px 0 0 0 ${theme.colors.accent.main}`,
      },
      '&:hover': {
        backgroundColor: theme.colors.emphasize(background, 0.1),
      },
    }),
    callersTargetRow: css({
      backgroundColor: theme.colors.emphasize(background, 0.08),
      fontWeight: theme.typography.fontWeightMedium,
      '& > td:first-of-type': {
        boxShadow: `inset 3px 0 0 0 ${theme.colors.info.main}`,
      },
      '&:hover': {
        backgroundColor: theme.colors.emphasize(background, 0.1),
      },
    }),
    searchMatchRow: css({
      backgroundColor: searchFill,
      fontWeight: theme.typography.fontWeightMedium,
      '& > td:first-of-type': {
        boxShadow: `inset 3px 0 0 0 ${theme.colors.warning.main}`,
      },
      '&:hover': {
        backgroundColor: searchHoverFill,
      },
    }),
    td: css({
      padding: '0px 6px',
      borderBottom: 'none',
      height: '24px',
      verticalAlign: 'middle',
      overflow: 'hidden',
    }),
    sortIcon: css({
      marginLeft: theme.spacing(0.5),
    }),
    actionsColumnCell: css({
      backgroundColor: theme.colors.background.secondary,
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
      },
    }),
    valueColumnCell: css({
      overflow: 'visible',
      textAlign: 'right',
    }),
    pinnedCell: css({
      zIndex: 1,
      // Follow the row highlight. The row fill is opaque, so a scrolled name does not show through.
      backgroundColor: 'inherit',
    }),
  };
}

function renderCell(cell: Cell<CallTreeNode>) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const CellRenderer = cell.column.Cell as ComponentType<{ row: Row<CallTreeNode>; value: unknown }>;
  return <CellRenderer row={cell.row} value={cell.value} />;
}
