import { cx } from '@emotion/css';
import { useEffect } from 'react';
import { Row, HeaderGroup, TablePropGetter, TableBodyPropGetter, TableProps, TableBodyProps } from 'react-table';

import { Styles } from './styles';
import { CallTreeNode } from './utils';

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
  styles: Styles;
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
  styles,
  currentSearchMatchId,
  searchMatchRowRef,
  scrollContainerRef,
  focusedNodeId,
  callersNodeLabel,
}: CallTreeTableProps) {
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

  const functionColumnWidth = getFunctionColumnWidth(availableWidth, isCompact);

  if (width < 3 || height < 3) {
    return null;
  }

  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column' }}>
      <table {...getTableProps()} className={styles.table} style={{ flexShrink: 0 }}>
        <thead className={styles.thead}>
          {headerGroups.map((headerGroup) => {
            const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
            return (
              <tr key={key} {...headerGroupProps}>
                {headerGroup.headers.map((column) => {
                  const { key: headerKey, ...headerProps } = column.getHeaderProps(column.getSortByToggleProps());
                  const columnWidth = column.id === 'label' ? functionColumnWidth : column.width;
                  return (
                    <th
                      key={headerKey}
                      {...headerProps}
                      className={styles.th}
                      style={{
                        ...(columnWidth !== undefined && { width: columnWidth }),
                        textAlign: column.id === 'self' || column.id === 'total' ? 'right' : undefined,
                        ...(column.minWidth !== undefined && { minWidth: column.minWidth }),
                      }}
                    >
                      {column.render('Header')}
                      <span className={styles.sortIndicator}>
                        {column.isSorted ? (column.isSortedDesc ? ' ▼' : ' ▲') : ''}
                      </span>
                    </th>
                  );
                })}
              </tr>
            );
          })}
        </thead>
      </table>
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }}
        className={styles.scrollContainer}
      >
        <table {...getTableProps()} className={styles.table}>
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
                    const columnWidth = cell.column.id === 'label' ? functionColumnWidth : cell.column.width;
                    return (
                      <td
                        key={cellKey}
                        {...cellProps}
                        className={cx(
                          styles.td,
                          isActionsColumn && styles.actionsColumnCell,
                          isValueColumn && styles.valueColumnCell
                        )}
                        style={{
                          ...(columnWidth !== undefined && { width: columnWidth }),
                          ...(cell.column.minWidth !== undefined && { minWidth: cell.column.minWidth }),
                        }}
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
    </div>
  );
}
