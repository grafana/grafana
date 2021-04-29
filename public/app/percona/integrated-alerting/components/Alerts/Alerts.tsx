import React, { FC, useCallback, useEffect, useState } from 'react';
import { useStyles, useTheme } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { Cell, Column } from 'react-table';
import { cx } from 'emotion';
import { Table } from '../Table/Table';
import { Severity } from '../Severity';
import { Messages } from '../../IntegratedAlerting.messages';
import { getStyles } from './Alerts.styles';
import { Alert, AlertStatus } from './Alerts.types';
import { formatAlerts } from './Alerts.utils';
import { AlertsService } from './Alerts.service';
import { AlertsActions } from './AlertsActions';
import { GET_ALERTS_CANCEL_TOKEN } from './Alerts.constants';

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
  const [generateToken] = useCancelToken();
  const columns = React.useMemo(
    () => [
      {
        Header: summaryColumn,
        accessor: 'summary',
        width: '30%',
      } as Column,
      {
        Header: severityColumn,
        accessor: 'severity',
        Cell: ({ row, value }) => (
          <Severity
            severity={value}
            className={cx({ [style.silencedSeverity]: (row.original as Alert).status === AlertStatus.SILENCED })}
          />
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
      const { alerts } = await AlertsService.list(generateToken(GET_ALERTS_CANCEL_TOKEN));
      setData(formatAlerts(alerts));
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPendingRequest(false);
  };

  const getCellProps = useCallback(
    (cell: Cell<Alert>) => ({
      className: cell.row.original.status === AlertStatus.SILENCED ? style.disabledRow : '',
      key: cell.row.original.alertId,
    }),
    []
  );

  useEffect(() => {
    getAlerts();
  }, []);

  return (
    <Table
      totalItems={data.length}
      data={data}
      columns={columns}
      pendingRequest={pendingRequest}
      emptyMessage={noData}
      getCellProps={getCellProps}
    />
  );
};
