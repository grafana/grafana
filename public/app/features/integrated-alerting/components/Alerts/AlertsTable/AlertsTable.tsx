/* eslint-disable react/display-name */
import React, { useEffect, useState, useMemo } from 'react';
import { useTable, Column } from 'react-table';
import { cx, css } from 'emotion';
import { Spinner, useStyles, useTheme } from '@grafana/ui';
import { getStyles } from './AlertsTable.styles';
import { logger } from '@percona/platform-core';
import { AlertsService } from '../Alerts.service';
import { Messages } from '../../../IntegratedAlerting.messages';
import { Alert, AlertStatus } from '../Alerts.types';
import { formatAlerts, getSeverityColors } from './AlertsTable.utils';
import { AlertsActions } from '../AlertsActions/AlertsActions';
import { AlertRuleSeverity } from '../../AlertRules/AlertRules.types';
import { EmptyBlock } from '../../EmptyBlock';

const { noData, columns } = Messages.alerts.table;

const {
  activeSince: activeSinceColumn,
  labels: labelsColumn,
  lastNotified: lastNotifiedColumn,
  severity: severityColumn,
  state: stateColumn,
  summary: summaryColumn,
  actions: actionsColumn,
} = columns;

export const AlertsTable = () => {
  const style = useStyles(getStyles);
  const theme = useTheme();
  const [pendingRequest, setPendingRequest] = useState(false);
  const [data, setData] = useState<Alert[]>([]);
  const severityColors = useMemo(() => getSeverityColors(theme), [theme]);

  const getAlerts = async () => {
    setPendingRequest(true);
    try {
      const { alerts } = await AlertsService.list();
      setData(formatAlerts(alerts));
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
        width: '30%',
      } as Column,
      {
        Header: severityColumn,
        accessor: ({ severity, status }: Alert) => (
          <span
            className={cx({
              [style.getSeverityStyle(severityColors[severity as AlertRuleSeverity])]: status !== AlertStatus.SILENCED,
            })}
          >
            {severity}
          </span>
        ),
        width: '5%',
      } as Column,
      {
        Header: stateColumn,
        accessor: 'status',
        width: '5%',
      } as Column,
      {
        Header: labelsColumn,
        accessor: ({ labels }: Alert) => (
          <div className={style.labelsWrapper}>
            {labels.map((label) => (
              <span key={label} className={style.label}>
                {label}
              </span>
            ))}
          </div>
        ),
        width: '40%',
      } as Column,
      {
        Header: activeSinceColumn,
        accessor: ({ activeSince }: Alert) => <>{activeSince ? activeSince : null}</>,
        width: '10%',
      } as Column,
      {
        Header: lastNotifiedColumn,
        accessor: ({ lastNotified }: Alert) => <>{lastNotified ? lastNotified : null}</>,
        width: '10%',
      } as Column,
      {
        Header: actionsColumn,
        accessor: (alert: Alert) => <AlertsActions alert={alert} getAlerts={getAlerts} />,
      } as Column,
    ],
    [severityColors, style]
  );

  useEffect(() => {
    getAlerts();
  }, []);

  const tableInstance = useTable({ columns, data });
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = tableInstance;

  return (
    <div className={style.tableWrap} data-qa="alerts-table-outer-wrapper">
      <div className={style.table} data-qa="alerts-inner-wrapper">
        {pendingRequest ? (
          <EmptyBlock dataQa="alerts-table-loading">
            <Spinner />
          </EmptyBlock>
        ) : null}
        {!rows.length && !pendingRequest ? (
          <EmptyBlock dataQa="alerts-table-no-data">{<h1>{noData}</h1>}</EmptyBlock>
        ) : null}
        {rows.length && !pendingRequest ? (
          <table {...getTableProps()} data-qa="alerts-table">
            <thead data-qa="alerts-table-thead">
              {headerGroups.map((headerGroup) => (
                /* eslint-disable-next-line react/jsx-key */
                <tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map((column) => (
                    /* eslint-disable-next-line react/jsx-key */
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
            <tbody {...getTableBodyProps()} data-qa="alerts-table-tbody">
              {rows.map((row) => {
                prepareRow(row);
                return (
                  /* eslint-disable-next-line react/jsx-key */
                  <tr
                    {...row.getRowProps()}
                    className={(row.original as Alert).status === 'Silenced' ? style.disabledRow : ''}
                  >
                    {row.cells.map((cell) => (
                      /* eslint-disable-next-line react/jsx-key */
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
