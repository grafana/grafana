/* eslint-disable react/display-name */
import React, { FC, useState, useMemo, useEffect, useCallback } from 'react';
import { Column, Row } from 'react-table';
import { logger } from '@percona/platform-core';
import Page from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { ExpandableCell } from 'app/percona/shared/components/Elements/ExpandableCell';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { Status } from '../Status';
import { Messages } from '../../Backup.messages';
import { DetailedDate } from '../DetailedDate';
import { Restore } from './RestoreHistory.types';
import { RestoreHistoryService } from './RestoreHistory.service';
import { RestoreHistoryDetails } from './RestoreHistoryDetails';
import { DATA_INTERVAL, LIST_RESTORES_CANCEL_TOKEN } from './RestoreHistory.constants';

export const RestoreHistory: FC = () => {
  const [pending, setPending] = useState(true);
  const [data, setData] = useState<Restore[]>([]);
  const navModel = usePerconaNavModel('restore-history');
  const [generateToken] = useCancelToken();
  const [triggerTimeout] = useRecurringCall();
  const columns = useMemo(
    (): Array<Column<Restore>> => [
      {
        Header: Messages.backupInventory.table.columns.name,
        accessor: 'name',
        id: 'name',
        width: '250px',
        Cell: ({ row, value }) => <ExpandableCell row={row} value={value} />,
      },
      {
        Header: Messages.backupInventory.table.columns.vendor,
        accessor: ({ vendor }: Restore) => DATABASE_LABELS[vendor],
        width: '150px',
      },
      {
        Header: Messages.restoreHistory.table.columns.started,
        accessor: 'started',
        Cell: ({ value }) => <DetailedDate date={value} />,
      },
      {
        Header: Messages.backupInventory.table.columns.location,
        accessor: 'locationName',
      },
      {
        Header: Messages.backupInventory.table.columns.status,
        accessor: 'status',
        Cell: ({ value }) => <Status status={value} />,
      },
    ],
    []
  );

  const renderSelectedSubRow = React.useCallback(
    (row: Row<Restore>) => (
      <RestoreHistoryDetails
        name={row.original.name}
        finished={row.original.finished}
        dataModel={row.original.dataModel}
      />
    ),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);

  useEffect(() => {
    const getData = async (showLoading = false) => {
      showLoading && setPending(true);

      try {
        const restores = await RestoreHistoryService.list(generateToken(LIST_RESTORES_CANCEL_TOKEN));
        setData(restores);
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      }
      setPending(false);
    };

    getData(true).then(() => triggerTimeout(getData, DATA_INTERVAL));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <TechnicalPreview />
        <FeatureLoader featureName={Messages.backupManagement} featureSelector={featureSelector}>
          <Table
            columns={columns}
            data={data}
            totalItems={data.length}
            emptyMessage={Messages.restoreHistory.table.noData}
            pendingRequest={pending}
            renderExpandedRow={renderSelectedSubRow}
          />
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default RestoreHistory;
