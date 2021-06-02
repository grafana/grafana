import React, { FC, useEffect, useMemo, useState } from 'react';
import { useStyles, useTheme } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Column } from 'react-table';
import { cx } from 'emotion';
import { Table } from '../Table/Table';
import { Messages } from '../../IntegratedAlerting.messages';
import { getStyles } from './Alerts.styles';
import { Alert, AlertStatus } from './Alerts.types';
import { formatAlerts, getSeverityColors } from './Alerts.utils';
import { AlertsService } from './Alerts.service';
import { AlertRuleSeverity } from '../AlertRules/AlertRules.types';
import { AlertsActions } from './AlertsActions';

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

export const Alerts: FC = () => {
  const style = useStyles(getStyles);
  const theme = useTheme();
  const [pendingRequest, setPendingRequest] = useState(true);
  const [data, setData] = useState<Alert[]>([]);
  const severityColors = useMemo(() => getSeverityColors(theme), [theme]);
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
            {labels.map(label => (
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
        accessor: 'activeSince',
        width: '10%',
      } as Column,
      {
        Header: lastNotifiedColumn,
        accessor: 'lastNotified',
        width: '10%',
      } as Column,
      {
        Header: actionsColumn,
        accessor: (alert: Alert) => <AlertsActions alert={alert} getAlerts={getAlerts} />,
      } as Column,
    ],
    [theme]
  );

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

  useEffect(() => {
    getAlerts();
  }, []);

  return (
    <Table totalItems={data.length} data={data} columns={columns} pendingRequest={pendingRequest} emptyMessage={noData}>
      {(rows, table) =>
        rows.map(row => {
          const { prepareRow } = table;
          prepareRow(row);
          const alert = row.original as Alert;
          return (
            <tr
              {...row.getRowProps()}
              key={alert.alertId}
              className={alert.status === AlertStatus.SILENCED ? style.disabledRow : ''}
            >
              {row.cells.map(cell => (
                <td {...cell.getCellProps()} key={cell.column.id}>
                  {cell.render('Cell')}
                </td>
              ))}
            </tr>
          );
        })
      }
    </Table>
  );
};
