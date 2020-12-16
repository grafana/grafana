import React, { FC } from 'react';
import { useTable } from 'react-table';
import { css } from 'emotion';
import { Spinner, useStyles } from '@grafana/ui';
import { getStyles } from './Table.styles';
import { TableProps } from './Table.types';

export const Table: FC<TableProps> = ({ pendingRequest, data, columns, emptyMessage }) => {
  const style = useStyles(getStyles);
  const tableInstance = useTable({ columns, data });
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

  return (
    <div className={style.tableWrap} data-qa="table-outer-wrapper">
      <div className={style.table} data-qa="table-inner-wrapper">
        {pendingRequest ? (
          <div data-qa="table-loading" className={style.empty}>
            <Spinner />
          </div>
        ) : null}
        {!rows.length && !pendingRequest ? (
          <div data-qa="table-no-data" className={style.empty}>
            {<h1>{emptyMessage}</h1>}
          </div>
        ) : null}
        {rows.length && !pendingRequest ? (
          <table {...getTableProps()} data-qa="table">
            <thead data-qa="table-thead">
              {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map(column => (
                    <th
                      className={css`
                        cursor: pointer;
                        width: ${column.width};
                      `}
                      {...column.getHeaderProps()}
                    >
                      {column.render('Header')}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()} data-qa="table-tbody">
              {rows.map(row => {
                prepareRow(row);
                return (
                  <tr {...row.getRowProps()}>
                    {row.cells.map(cell => {
                      return <td {...cell.getCellProps()}>{cell.render('Cell')}</td>;
                    })}
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
