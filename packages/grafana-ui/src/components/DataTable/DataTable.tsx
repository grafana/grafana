import { cx, css } from '@emotion/css';
import React, { useMemo, Fragment, ReactNode } from 'react';
import { useExpanded, useSortBy, useTable, TableOptions } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

import { Column, isTruthy } from './types';
import { EXPANDER_CELL_ID, getColumns } from './utils';

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    border-radius: ${theme.shape.borderRadius()};
    border: solid 1px ${theme.colors.border.weak};
    background-color: ${theme.colors.background.secondary};
    width: 100%;
    th {
      position: relative;
      white-space: nowrap;
      padding: ${theme.spacing(1)};
      padding-right: ${theme.spacing(2.5)};
    }

    td {
      padding: ${theme.spacing(1)};
    }

    td,
    th {
      min-width: ${theme.spacing(3)};
    }
  `,
  evenRow: css`
    background: ${theme.colors.background.primary};
  `,
  shrink: css`
    width: 0%;
  `,
  sortIcon: css`
    position: absolute;
    top: ${theme.spacing(1)};
  `,
  sortableHeader: css`
    &:hover {
      background-color: ${theme.colors.emphasize(theme.colors.background.secondary, 0.05)};
    }
  `,
});

interface Props<TableData extends object> {
  columns: Array<Column<TableData>>;
  data: TableData[];
  renderExpandedRow?: (row: TableData) => ReactNode;
  className?: string;
  getRowId: TableOptions<TableData>['getRowId'];
}

/** @beta */
export function DataTable<TableData extends object>({
  data,
  className,
  columns,
  renderExpandedRow,
  getRowId,
}: Props<TableData>) {
  const styles = useStyles2(getStyles);
  const tableColumns = useMemo(() => {
    const cols = getColumns<TableData>(columns);
    return cols;
  }, [columns]);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable<TableData>(
    {
      columns: tableColumns,
      data,
      autoResetExpanded: false,
      autoResetSortBy: false,
      getRowId,
      initialState: {
        hiddenColumns: [
          !renderExpandedRow && EXPANDER_CELL_ID,
          ...tableColumns
            .filter((col) => !(col.visible?.(data) ?? true))
            .map((c) => c.id)
            .filter(isTruthy),
        ].filter(isTruthy),
      },
    },
    useSortBy,
    useExpanded
  );
  // This should be called only for rows thar we'd want to actually render, which is all at this stage.
  // We may want to revisit this if we decide to add pagination and/or virtualized tables.
  rows.forEach(prepareRow);

  return (
    <table {...getTableProps()} className={cx(styles.table, className)}>
      <thead>
        {headerGroups.map((headerGroup) => {
          const { key, ...headerRowProps } = headerGroup.getHeaderGroupProps();

          return (
            <tr key={key} {...headerRowProps}>
              {headerGroup.headers.map((column) => {
                // TODO: if the column is a function, it should also provide an accessible name as a string to be used a the column title in getSortByToggleProps
                const { key, ...headerCellProps } = column.getHeaderProps(
                  column.canSort ? column.getSortByToggleProps() : undefined
                );

                return (
                  <th
                    key={key}
                    className={cx({ [styles.shrink]: column.width === 0, [styles.sortableHeader]: column.canSort })}
                    {...headerCellProps}
                  >
                    {column.render('Header')}

                    {column.isSorted && (
                      <span
                        // FIXME: move this
                        className={styles.sortIcon}
                      >
                        <Icon name={column.isSortedDesc ? 'angle-down' : 'angle-up'} />
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          );
        })}
      </thead>

      <tbody {...getTableBodyProps()}>
        {rows.map((row, rowIndex) => {
          const className = cx(rowIndex % 2 === 0 && styles.evenRow);
          const { key, ...otherRowProps } = row.getRowProps();

          return (
            <Fragment key={key}>
              <tr className={className} {...otherRowProps}>
                {row.cells.map((cell) => {
                  const { key, ...otherCellProps } = cell.getCellProps();
                  return (
                    <td key={key} {...otherCellProps}>
                      {cell.render('Cell')}
                    </td>
                  );
                })}
              </tr>
              {
                // @ts-expect-error react-table doesn't ship with useExpanded types and we can't use declaration merging without affecting the table viz
                row.isExpanded && renderExpandedRow && (
                  <tr className={className} {...otherRowProps}>
                    <td colSpan={row.cells.length}>{renderExpandedRow(row.original)}</td>
                  </tr>
                )
              }
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
