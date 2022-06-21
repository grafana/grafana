import { css } from 'emotion';
import React, { FC } from 'react';
import { useTable } from 'react-table';

import { Spinner, useStyles } from '@grafana/ui';

import { AlertRule } from '../AlertRules.types';

import { getStyles } from './AlertRulesTable.styles';
import { AlertRulesTableProps } from './AlertRulesTable.types';

export const AlertRulesTable: FC<AlertRulesTableProps> = ({ pendingRequest, data, columns, emptyMessage }) => {
  const style = useStyles(getStyles);
  const tableInstance = useTable({ columns, data });
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

  return (
    <div className={style.tableWrap} data-qa="alert-rules-table-outer-wrapper">
      <div className={style.table} data-qa="alert-rules-inner-wrapper">
        {pendingRequest ? (
          <div data-qa="alert-rules-table-loading" className={style.empty}>
            <Spinner />
          </div>
        ) : null}
        {!rows.length && !pendingRequest ? (
          <div data-qa="alert-rules-table-no-data" className={style.empty}>
            {<h1>{emptyMessage}</h1>}
          </div>
        ) : null}
        {rows.length && !pendingRequest ? (
          <table {...getTableProps()} data-qa="alert-rules-table">
            <thead data-qa="alert-rules-table-thead">
              {headerGroups.map((headerGroup) => (
                // eslint-disable-next-line react/jsx-key
                <tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map((column) => (
                    // eslint-disable-next-line react/jsx-key
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
            <tbody {...getTableBodyProps()} data-qa="alert-rules-table-tbody">
              {rows.map((row) => {
                prepareRow(row);
                return (
                  // eslint-disable-next-line react/jsx-key
                  <tr {...row.getRowProps()} className={(row.original as AlertRule).disabled ? style.disabledRow : ''}>
                    {row.cells.map((cell) => (
                      // eslint-disable-next-line react/jsx-key
                      <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
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
