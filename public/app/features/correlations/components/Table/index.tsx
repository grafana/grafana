import { cx, css } from '@emotion/css';
import React, { useMemo, Fragment, ReactNode } from 'react';
import {
  CellProps,
  SortByFn,
  useExpanded,
  useSortBy,
  useTable,
  DefaultSortTypes,
  TableOptions,
  IdType,
} from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { isTruthy } from 'app/core/utils/types';

import { EXPANDER_CELL_ID, getColumns } from './utils';

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    border-radius: ${theme.shape.borderRadius()};
    border: solid 1px ${theme.colors.border.weak};
    background-color: ${theme.colors.background.secondary};
    width: 100%;
    td,
    th {
      padding: ${theme.spacing(1)};
      min-width: ${theme.spacing(3)};
    }
  `,
  evenRow: css`
    background: ${theme.colors.background.primary};
  `,
  shrink: css`
    width: 0%;
  `,
});

export interface Column<TableData extends object> {
  /**
   * ID of the column.
   * Set this to the matching object key of your data or `undefined` if the column doesn't have any associated data with it.
   * This must be unique among all other columns.
   */
  id?: IdType<TableData>;
  cell?: (props: CellProps<TableData>) => ReactNode;
  header?: (() => ReactNode | string) | string;
  sortType?: DefaultSortTypes | SortByFn<TableData>;
  shrink?: boolean;
  visible?: (col: TableData[]) => boolean;
}

interface Props<TableData extends object> {
  columns: Array<Column<TableData>>;
  data: TableData[];
  renderExpandedRow?: (row: TableData) => JSX.Element;
  className?: string;
  getRowId: TableOptions<TableData>['getRowId'];
}

/**
 * non-viz table component.
 * Will need most likely to be moved in @grafana/ui
 */
export function Table<TableData extends object>({
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
                  <th key={key} className={cx(column.width === 0 && styles.shrink)} {...headerCellProps}>
                    {column.render('Header')}

                    {column.isSorted && <Icon name={column.isSortedDesc ? 'angle-down' : 'angle-up'} />}
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
