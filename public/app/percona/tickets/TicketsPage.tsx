import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Column, Row } from 'react-table';
import { useSelector } from 'react-redux';
import { Table } from '../integrated-alerting/components/Table';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { LIST_TICKETS_CANCEL_TOKEN, PAGE_MODEL } from './Tickets.constants';
import { logger } from '@percona/platform-core';
import { isApiCancelError } from '../shared/helpers/api';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { TicketsService } from './Tickets.service';
import { Ticket } from './Tickets.types';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './Tickets.styles';
import { Messages } from './Tickets.messages';
import { getPerconaUser } from '../shared/core/selectors';

export const TicketsPage: FC = () => {
  const [pending, setPending] = useState(true);
  const [data, setData] = useState<Ticket[]>([]);
  const { isPlatformUser } = useSelector(getPerconaUser);
  const [generateToken] = useCancelToken();
  const styles = useStyles2(getStyles);

  const columns = useMemo(
    (): Array<Column<Ticket>> => [
      {
        Header: Messages.table.columns.number,
        accessor: 'number',
      },
      {
        Header: Messages.table.columns.description,
        accessor: 'shortDescription',
      },
      {
        Header: Messages.table.columns.priority,
        accessor: 'priority',
      },
      {
        Header: Messages.table.columns.state,
        accessor: 'state',
      },
      {
        Header: Messages.table.columns.createDate,
        accessor: 'createTime',
      },
      {
        Header: Messages.table.columns.department,
        accessor: 'department',
      },
      {
        Header: Messages.table.columns.type,
        accessor: 'taskType',
      },
    ],
    []
  );

  const getData = useCallback(async (showLoading = false) => {
    showLoading && setPending(true);
    try {
      const tickets = await TicketsService.list(generateToken(LIST_TICKETS_CANCEL_TOKEN));
      setData(tickets);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPlatformUser === true) {
      getData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformUser]);

  const getRowProps = (row: Row<Ticket>) => ({
    key: row.original.url,
    onClick: () => window.open(row.original.url, '_blank'),
    className: styles.rowProps,
  });

  const getCellProps = (cell: Cell<Ticket>) => ({
    key: cell.value,
    className: styles.cellProps,
  });

  return (
    <PageWrapper pageModel={PAGE_MODEL} dataTestId="page-wrapper-tickets">
      <PlatformConnectedLoader>
        <div className={styles.pageWrapper}>
          <Table
            data={data}
            columns={columns}
            totalItems={data.length}
            pendingRequest={pending}
            emptyMessage={Messages.table.noData}
            getRowProps={getRowProps}
            getCellProps={getCellProps}
          ></Table>
        </div>
      </PlatformConnectedLoader>
    </PageWrapper>
  );
};

export default TicketsPage;
