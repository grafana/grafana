import React, { FC, useEffect } from 'react';
import { useRowSelect, useTable } from 'react-table';
import { Checkbox, Spinner, useTheme } from '@grafana/ui';
import { cx } from 'emotion';
import { getStyles } from './Table.styles';
import { TableCheckboxProps, TableProps } from './Table.types';

const TableCheckbox = ({ className, checked, onChange, title }: TableCheckboxProps) => (
  <div className={className}>
    <Checkbox name="table-checkbox" checked={checked} title={title} onChange={onChange} />
  </div>
);

export const Table: FC<TableProps> = ({
  className,
  columns,
  rowSelection = false,
  onRowSelection,
  data,
  noData,
  loading,
  rowKey,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    // @ts-ignore
    selectedFlatRows,
  } = useTable(
    {
      columns,
      data,
    },
    useRowSelect,
    hooks => {
      if (rowSelection) {
        hooks.visibleColumns.push(columns => [
          {
            id: 'selection',
            Header: ({ getToggleAllRowsSelectedProps }: any) => (
              <div data-qa="select-all">
                <TableCheckbox className={styles.checkbox} {...getToggleAllRowsSelectedProps()} />
              </div>
            ),
            Cell: ({ row }: { row: any }) => (
              <div data-qa="select-row">
                <TableCheckbox className={styles.checkbox} {...row.getToggleRowSelectedProps()} />
              </div>
            ),
          },
          ...columns,
        ]);
      }
    }
  );

  useEffect(() => {
    if (onRowSelection) {
      onRowSelection(selectedFlatRows);
    }
  }, [selectedFlatRows]);

  return (
    <div className={cx(styles.table, className)}>
      <div className={styles.tableWrap}>
        {loading ? (
          <div data-qa="table-loading" className={styles.empty}>
            <Spinner />
          </div>
        ) : null}
        {!rows.length && !loading ? (
          <div data-qa="table-no-data" className={styles.empty}>
            {noData || <h1>No data</h1>}
          </div>
        ) : null}
        {rows.length && !loading ? (
          <table {...getTableProps()}>
            <thead>
              {headerGroups.map((headerGroup, i) => (
                <tr data-qa="table-header" {...headerGroup.getHeaderGroupProps()} key={i}>
                  {headerGroup.headers.map((column, index) => (
                    <th
                      {...column.getHeaderProps()}
                      className={index === 0 && rowSelection ? styles.checkboxColumn : ''}
                      key={index}
                    >
                      {column.render('Header')}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {rows.map((row, i) => {
                prepareRow(row);

                return (
                  <tr data-qa="table-row" {...row.getRowProps()} key={rowKey ? rowKey(row) : i}>
                    {row.cells.map((cell, index) => (
                      <td
                        {...cell.getCellProps()}
                        className={index === 0 && rowSelection ? styles.checkboxColumn : ''}
                        key={index}
                      >
                        {cell.render('Cell')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
};
