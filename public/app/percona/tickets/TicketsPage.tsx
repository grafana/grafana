import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Column, Row } from 'react-table';

import { useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { logger } from 'app/percona/shared/helpers/logger';
import { useSelector } from 'app/types';

import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { Table } from '../shared/components/Elements/Table';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { getPerconaUser } from '../shared/core/selectors';
import { isApiCancelError } from '../shared/helpers/api';

import { LIST_TICKETS_CANCEL_TOKEN } from './Tickets.constants';
import { Messages } from './Tickets.messages';
import { TicketsService } from './Tickets.service';
import { getStyles } from './Tickets.styles';
import { Ticket } from './Tickets.types';

export const TicketsPage: FC = () => {
  const [pending, setPending] = useState(true);
  const [data, setData] = useState<Ticket[]>([]);
  const { isPlatformUser } = useSelector(getPerconaUser);
  const [generateToken] = useCancelToken();
  const styles = useStyles2(getStyles);
  const navModel = usePerconaNavModel('tickets');

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
    <OldPage navModel={navModel}>
      <OldPage.Contents dataTestId="page-wrapper-tickets">
        <PlatformConnectedLoader>
          <Table
            data={data}
            columns={columns}
            totalItems={data.length}
            pendingRequest={pending}
            emptyMessage={Messages.table.noData}
            getRowProps={getRowProps}
            getCellProps={getCellProps}
          ></Table>
        </PlatformConnectedLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default TicketsPage;
