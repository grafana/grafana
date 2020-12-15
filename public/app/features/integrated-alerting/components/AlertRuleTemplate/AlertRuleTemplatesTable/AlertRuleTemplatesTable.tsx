import React, { FC } from 'react';
import { useTable, Column } from 'react-table';
import { Spinner, useStyles } from '@grafana/ui';
import { getStyles } from './AlertRuleTemplatesTable.styles';
import { css } from 'emotion';
import { FormattedTemplate, AlertRuleTemplatesTableProps } from './AlertRuleTemplatesTable.types';
import { Messages } from '../../../IntegratedAlerting.messages';
import { AlertRuleTemplateActions } from '../AlertRuleTemplateActions/AlertRuleTemplateActions';

const { noData, columns } = Messages.alertRuleTemplate.table;

const { name: nameColumn, source: sourceColumn, createdAt: createdAtColumn, actions: actionsColumn } = columns;

export const AlertRuleTemplatesTable: FC<AlertRuleTemplatesTableProps> = ({
  pendingRequest,
  data,
  getAlertRuleTemplates,
}) => {
  const style = useStyles(getStyles);

  const columns = React.useMemo(
    () => [
      {
        Header: nameColumn,
        accessor: 'summary',
        width: '70%',
      } as Column,
      {
        Header: sourceColumn,
        accessor: 'source',
        width: '20%',
      } as Column,
      {
        Header: createdAtColumn,
        accessor: ({ created_at }: FormattedTemplate) => (created_at ? created_at : '-'),
        width: '10%',
      } as Column,
      {
        Header: actionsColumn,
        accessor: (template: FormattedTemplate) => (
          <AlertRuleTemplateActions template={template} getAlertRuleTemplates={getAlertRuleTemplates} />
        ),
      } as Column,
    ],
    []
  );

  const tableInstance = useTable({ columns, data });
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

  return (
    <div className={style.tableWrap} data-qa="alert-rule-templates-table-outer-wrapper">
      <div className={style.table} data-qa="alert-rule-templates-inner-wrapper">
        {pendingRequest ? (
          <div data-qa="alert-rule-templates-table-loading" className={style.empty}>
            <Spinner />
          </div>
        ) : null}
        {!rows.length && !pendingRequest ? (
          <div data-qa="alert-rule-templates-table-no-data" className={style.empty}>
            {<h1>{noData}</h1>}
          </div>
        ) : null}
        {rows.length && !pendingRequest ? (
          <table {...getTableProps()} data-qa="alert-rule-templates-table">
            <thead data-qa="alert-rule-templates-table-thead">
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
            <tbody {...getTableBodyProps()} data-qa="alert-rule-templates-table-tbody">
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
