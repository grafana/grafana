import { logger } from '@percona/platform-core';
import { css } from 'emotion';
import React, { useEffect, useState } from 'react';
import { useTable, Column } from 'react-table';

import { Spinner, useStyles } from '@grafana/ui';

import { Messages } from '../../../IntegratedAlerting.messages';
import { AlertRulesService } from '../AlertRules.service';
import { AlertRule } from '../AlertRules.types';

import { getStyles } from './AlertRulesTable.styles';
import { formatRules } from './AlertRulesTable.utils';

const { noData, columns } = Messages.alertRules.table;

const {
  createdAt: createdAtColumn,
  duration: durationColumn,
  filters: filtersColumn,
  lastNotified: lastNotifiedColumn,
  severity: severityColumn,
  summary: summaryColumn,
  threshold: thresholdColumn,
} = columns;

export const AlertRulesTable = () => {
  const style = useStyles(getStyles);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [data, setData] = useState<AlertRule[]>([]);

  const getAlertRules = async () => {
    setPendingRequest(true);
    try {
      const { rules } = await AlertRulesService.list();
      setData(formatRules(rules));
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  const columns = React.useMemo(
    () => [
      {
        Header: summaryColumn,
        accessor: 'summary',
        width: '25%',
      } as Column,
      {
        Header: thresholdColumn,
        accessor: 'threshold',
        width: '10%',
      } as Column,
      {
        Header: durationColumn,
        accessor: 'duration',
        width: '10%',
      } as Column,
      {
        Header: severityColumn,
        accessor: 'severity',
        width: '5%',
      } as Column,
      {
        Header: filtersColumn,
        accessor: ({ filters }: AlertRule) => (
          <div className={style.filtersWrapper}>
            {filters.map((filter) => (
              <span key={filter} className={style.filter}>
                {filter}
              </span>
            ))}
          </div>
        ),
        width: '30%',
      } as Column,
      {
        Header: createdAtColumn,
        accessor: 'createdAt',
        width: '10%',
      } as Column,
      {
        Header: lastNotifiedColumn,
        accessor: ({ lastNotified }: AlertRule) => (
          <>
            <div className={style.lastNotifiedWrapper}>
              {lastNotified ? (
                <>
                  <span className={style.lastNotifiedDate}>{lastNotified}</span>
                  <span className={style.lastNotifiedCircle} />
                </>
              ) : null}
            </div>
          </>
        ),
        width: '10%',
      } as Column,
    ],
    [style.filter, style.filtersWrapper, style.lastNotifiedCircle, style.lastNotifiedDate, style.lastNotifiedWrapper]
  );

  useEffect(() => {
    getAlertRules();
  }, []);

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
            {<h1>{noData}</h1>}
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
