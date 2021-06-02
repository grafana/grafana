import React, { useEffect, useState } from 'react';
import { useTable, Column } from 'react-table';
import { Spinner, useStyles } from '@grafana/ui';
import { getStyles } from './AlertRuleTemplatesTable.styles';
import { css } from 'emotion';
import { logger } from '@percona/platform-core';
import { AlertRuleTemplateService } from '../AlertRuleTemplate.service';
import { formatTemplates } from './AlertRuleTemplatesTable.utils';
import { FormattedTemplate } from './AlertRuleTemplatesTable.types';
import { Messages } from '../../../IntegratedAlerting.messages';

const { noData, columns } = Messages.alertRuleTemplate.table;

const { name: nameColumn, source: sourceColumn, createdAt: createdAtColumn } = columns;

export const AlertRuleTemplatesTable = () => {
  const style = useStyles(getStyles);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [data, setData] = useState<FormattedTemplate[]>([]);

  const getAlertRuleTemplates = async () => {
    setPendingRequest(true);
    try {
      const { templates } = await AlertRuleTemplateService.list();
      setData(formatTemplates(templates));
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

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
        accessor: 'created_at',
        width: '10%',
      } as Column,
    ],
    []
  );

  useEffect(() => {
    getAlertRuleTemplates();
  }, []);

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
