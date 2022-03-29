import React, { FC, useEffect, useState, useCallback, useMemo } from 'react';
import { LoaderButton, logger } from '@percona/platform-core';
import { Cell, Column, Row } from 'react-table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { ExtendedTableCellProps, ExtendedTableRowProps, Table } from 'app/percona/integrated-alerting/components/Table';
import { FailedCheckSummary } from 'app/percona/check/types';
import { AlertsReloadContext } from 'app/percona/check/Check.context';
import { CheckService } from 'app/percona/check/Check.service';
import { Spinner, useStyles2 } from '@grafana/ui';
import { Messages } from './FailedChecksTab.messages';
import { getStyles } from './FailedChecksTab.styles';
import { stripServiceId } from './FailedChecksTab.utils';
import { appEvents } from '../../../../core/app_events';
import { AppEvents } from '@grafana/data';
import { GET_ACTIVE_ALERTS_CANCEL_TOKEN } from './FailedChecksTab.constants';
import { locationService } from '@grafana/runtime';

export const FailedChecksTab: FC = () => {
  const [fetchAlertsPending, setFetchAlertsPending] = useState(true);
  const [runChecksPending, setRunChecksPending] = useState(false);
  const [data, setData] = useState<FailedCheckSummary[]>([]);
  const styles = useStyles2(getStyles);
  const [generateToken] = useCancelToken();

  const columns = useMemo(
    (): Array<Column<FailedCheckSummary>> => [
      {
        Header: 'Service Name',
        accessor: 'serviceName',
      },
      {
        Header: 'Critical',
        accessor: 'criticalCount',
      },
      {
        Header: 'Warning',
        accessor: 'warningCount',
      },
      {
        Header: 'Notice',
        accessor: 'noticeCount',
      },
    ],
    []
  );

  const fetchAlerts = useCallback(async (): Promise<void> => {
    setFetchAlertsPending(true);

    try {
      const checks = await CheckService.getAllFailedChecks(generateToken(GET_ACTIVE_ALERTS_CANCEL_TOKEN));
      setData(checks);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setFetchAlertsPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunChecksClick = async () => {
    setRunChecksPending(true);
    try {
      await CheckService.runDbChecks();
      appEvents.emit(AppEvents.alertSuccess, [Messages.checksExecutionStarted]);
    } catch (e) {
      logger.error(e);
    } finally {
      setRunChecksPending(false);
    }
  };

  const getRowProps = (row: Row<FailedCheckSummary>): ExtendedTableRowProps => ({
    key: row.original.serviceId,
    className: styles.row,
    onClick: () =>
      locationService.push(`/pmm-database-checks/service-checks/${stripServiceId(row.original.serviceId)}`),
  });

  const getCellProps = (cellInfo: Cell<FailedCheckSummary>): ExtendedTableCellProps => ({
    key: `${cellInfo.row.original.serviceId}-${cellInfo.row.id}`,
    className: styles.cell,
  });

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={styles.header}>
        <div className={styles.actionButtons} data-testid="db-check-panel-actions">
          <LoaderButton
            type="button"
            size="md"
            loading={runChecksPending}
            onClick={handleRunChecksClick}
            className={styles.runChecksButton}
          >
            {Messages.runDbChecks}
          </LoaderButton>
        </div>
      </div>
      <AlertsReloadContext.Provider value={{ fetchAlerts }}>
        {fetchAlertsPending ? (
          <div className={styles.spinner} data-testid="db-checks-failed-checks-spinner">
            <Spinner />
          </div>
        ) : (
          <Table
            totalItems={data.length}
            data={data}
            getRowProps={getRowProps}
            getCellProps={getCellProps}
            columns={columns}
            pendingRequest={fetchAlertsPending}
            emptyMessage={Messages.noChecks}
          />
        )}
      </AlertsReloadContext.Provider>
    </>
  );
};
