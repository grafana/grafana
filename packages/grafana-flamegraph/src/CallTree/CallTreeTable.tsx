import { css, cx } from '@emotion/css';
import { flexRender, type Table } from '@tanstack/react-table';
import { useEffect } from 'react';

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
  table: Table<CallTreeNode>;
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
  table,
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

  const functionColumnWidth = getFunctionColumnWidth(availableWidth, isCompact);
  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  if (width < 3 || height < 3) {
    return null;
  }

  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column' }}>
      <table className={styles.table} style={{ flexShrink: 0 }}>
        <thead className={styles.thead}>
          {headerGroups.map((headerGroup) => {
            return (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const { column } = header;
                  const columnWidth = column.id === 'label' ? functionColumnWidth : column.columnDef.size;
                  const sorted = column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={column.getToggleSortingHandler()}
                      className={styles.th}
                      style={{
                        ...(columnWidth !== undefined && { width: columnWidth }),
                        textAlign: column.id === 'self' || column.id === 'total' ? 'right' : undefined,
                        ...(column.columnDef.minSize !== undefined && { minWidth: column.columnDef.minSize }),
                      }}
                    >
                      {flexRender(column.columnDef.header, header.getContext())}
                      {sorted && (
                        <Icon
                          name={sorted === 'desc' ? 'arrow-down' : 'arrow-up'}
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
      </table>
      <div
        ref={scrollContainerRef}
        style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }}
        className={styles.scrollContainer}
      >
        <table className={styles.table}>
          <tbody className={styles.tbody}>
            {rows.map((row) => {
              const isFocusedRow = row.original.id === focusedNodeId;
              const isCallersTargetRow = callersNodeLabel && row.original.label === callersNodeLabel;
              const isSearchMatchRow = currentSearchMatchId && row.original.id === currentSearchMatchId;

              return (
                <tr
                  key={row.id}
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
                  {row.getVisibleCells().map((cell) => {
                    const isValueColumn = cell.column.id === 'self' || cell.column.id === 'total';
                    const isActionsColumn = cell.column.id === 'actions';
                    const columnWidth = cell.column.id === 'label' ? functionColumnWidth : cell.column.columnDef.size;
                    return (
                      <td
                        key={cell.id}
                        className={cx(
                          styles.td,
                          isActionsColumn && styles.actionsColumnCell,
                          isValueColumn && styles.valueColumnCell
                        )}
                        style={{
                          ...(columnWidth !== undefined && { width: columnWidth }),
                          ...(cell.column.columnDef.minSize !== undefined && {
                            minWidth: cell.column.columnDef.minSize,
                          }),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

function getStyles(theme: GrafanaTheme2) {
  return {
    scrollContainer: css({
      '&::-webkit-scrollbar': {
        width: '8px',
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
      width: '100%',
      tableLayout: 'fixed',
      borderCollapse: 'collapse',
      fontSize: theme.typography.fontSize,
      color: theme.colors.text.primary,
    }),
    thead: css({
      backgroundColor: theme.colors.background.secondary,
    }),
    th: css({
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
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),
    focusedRow: css({
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.08),
      borderLeft: `3px solid ${theme.colors.primary.main}`,
      fontWeight: theme.typography.fontWeightMedium,
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
      },
    }),
    callersTargetRow: css({
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.08),
      borderLeft: `3px solid ${theme.colors.info.main}`,
      fontWeight: theme.typography.fontWeightMedium,
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.1),
      },
    }),
    searchMatchRow: css({
      backgroundColor: theme.colors.warning.transparent,
      borderLeft: `3px solid ${theme.colors.warning.main}`,
      fontWeight: theme.typography.fontWeightMedium,
      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.warning.transparent, 0.1),
      },
    }),
    td: css({
      padding: '0px 6px',
      borderBottom: 'none',
      height: '20px',
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
  };
}
