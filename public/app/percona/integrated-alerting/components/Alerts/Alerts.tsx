import React, { FC, useCallback, useEffect, useState } from 'react';
import { useStyles, useTheme } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { ExpandableCell } from 'app/percona/shared/components/Elements/ExpandableCell';
import { Cell, Column, Row } from 'react-table';
import { cx } from 'emotion';
import { Table } from '../Table/Table';
import { Severity } from '../Severity';
import { useStoredTablePageSize } from '../Table/Pagination';
import { Messages } from '../../IntegratedAlerting.messages';
import { getStyles } from './Alerts.styles';
import { Alert, AlertStatus } from './Alerts.types';
import { formatAlerts } from './Alerts.utils';
import { AlertsService } from './Alerts.service';
import { AlertsActions } from './AlertsActions';
import { ALERT_RULE_TEMPLATES_TABLE_ID, GET_ALERTS_CANCEL_TOKEN } from './Alerts.constants';

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
  const [pageSize, setPageSize] = useStoredTablePageSize(ALERT_RULE_TEMPLATES_TABLE_ID);
  const [pageIndex, setPageindex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [generateToken] = useCancelToken();
  const columns = React.useMemo(
    (): Array<Column<Alert>> => [
      {
        Header: summaryColumn,
        accessor: 'summary',
        width: '30%',
        Cell: ({ row, value }) => <ExpandableCell row={row} value={value} />,
      },
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
      },
      {
        Header: stateColumn,
        accessor: 'status',
        width: '5%',
      },
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
      },
      {
        Header: activeSinceColumn,
        accessor: 'activeSince',
        width: '10%',
      },
      {
        Header: lastNotifiedColumn,
        accessor: 'lastNotified',
        width: '10%',
      },
      {
        Header: actionsColumn,
        accessor: (alert: Alert) => <AlertsActions alert={alert} getAlerts={getAlerts} />,
      },
    ],
    [theme]
  );

  const getAlerts = async () => {
    setPendingRequest(true);
    try {
      const { alerts, totals } = await AlertsService.list(pageSize, pageIndex, generateToken(GET_ALERTS_CANCEL_TOKEN));
      setData(formatAlerts(alerts));
      setTotalItems(totals.total_items || 0);
      setTotalPages(totals.total_pages || 0);
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

  const handlePaginationChanged = useCallback((pageSize: number, pageIndex: number) => {
    setPageSize(pageSize);
    setPageindex(pageIndex);
  }, []);

  const renderSelectedSubRow = React.useCallback((row: Row<Alert>) => <pre>{row.original.rule?.expr}</pre>, []);

  useEffect(() => {
    getAlerts();
  }, [pageSize, pageIndex]);

  return (
    <Table
      showPagination
      totalItems={totalItems}
      totalPages={totalPages}
      pageSize={pageSize}
      pageIndex={pageIndex}
      onPaginationChanged={handlePaginationChanged}
      data={data}
      columns={columns}
      pendingRequest={pendingRequest}
      emptyMessage={noData}
      getCellProps={getCellProps}
      renderExpandedRow={renderSelectedSubRow}
    />
  );
};
