import React, { FC, useContext } from 'react';
import { useTable } from 'react-table';
import { Spinner, useStyles } from '@grafana/ui';
import { css } from 'emotion';
import { getStyles } from './AlertRulesTable.styles';
import { AlertRule } from '../AlertRules.types';
import { AlertRulesTableProps } from './AlertRulesTable.types';
import { AlertRulesProvider } from '../AlertRules.provider';
import { EmptyBlock } from '../../EmptyBlock';

export const AlertRulesTable: FC<AlertRulesTableProps> = ({ pendingRequest, data, columns, emptyMessage }) => {
  const style = useStyles(getStyles);
  const { selectedRuleDetails } = useContext(AlertRulesProvider);
  const tableInstance = useTable({ columns, data });
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

  return (
    <div className={style.tableWrap} data-qa="alert-rules-table-outer-wrapper">
      <div className={style.table} data-qa="alert-rules-inner-wrapper">
        {pendingRequest ? (
          <EmptyBlock dataQa="alert-rules-table-loading">
            <Spinner />
          </EmptyBlock>
        ) : null}
        {!rows.length && !pendingRequest ? (
          <EmptyBlock dataQa="alert-rules-table-no-data">{<h1>{emptyMessage}</h1>}</EmptyBlock>
        ) : null}
        {rows.length && !pendingRequest ? (
          <table {...getTableProps()} data-qa="alert-rules-table">
            <thead data-qa="alert-rules-table-thead">
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
            <tbody {...getTableBodyProps()} data-qa="alert-rules-table-tbody">
              {rows.map(row => {
                prepareRow(row);
                const alertRule = row.original as AlertRule;

                return (
                  <>
                    <tr {...row.getRowProps()} className={alertRule.disabled ? style.disabledRow : ''}>
                      {row.cells.map(cell => (
                        <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
                      ))}
                    </tr>
                    {selectedRuleDetails && alertRule.ruleId === selectedRuleDetails.ruleId && (
                      <tr>
                        <td colSpan={columns.length}>
                          <pre data-qa="alert-rules-details" className={style.details}>
                            {alertRule.expr}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
};
