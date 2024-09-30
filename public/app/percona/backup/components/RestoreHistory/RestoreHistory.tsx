/* eslint-disable react/display-name */
import { CancelToken } from 'axios';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Row } from 'react-table';

import { Page } from 'app/core/components/Page/Page';
import { BackupStatus } from 'app/percona/backup/Backup.types';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backups/backupLocations';
import { getBackupLocations, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages } from '../../Backup.messages';
import { formatLocationsToMap } from '../../Backup.utils';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { DetailedDate } from '../DetailedDate';
import { Status } from '../Status';

import { DATA_INTERVAL, LIST_RESTORES_CANCEL_TOKEN } from './RestoreHistory.constants';
import { RestoreHistoryService } from './RestoreHistory.service';
import { Restore } from './RestoreHistory.types';
import { RestoreHistoryActions } from './RestoreHistoryActions';
import { RestoreHistoryDetails } from './RestoreHistoryDetails';
import { RestoreLogsModal } from './RestoreLogsModal/RestoreLogsModal';

export const RestoreHistory: FC = () => {
  const [pending, setPending] = useState(true);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [data, setData] = useState<Restore[]>([]);
  const [selectedRestore, setSelectedRestore] = useState<Restore | null>(null);
  const [generateToken] = useCancelToken();
  const [triggerTimeout] = useRecurringCall();
  const dispatch = useAppDispatch();
  const { result: locations = [] } = useSelector(getBackupLocations);

  const locationsByLocationId = useMemo(() => formatLocationsToMap(locations), [locations]);

  const columns = useMemo(
    (): Array<ExtendedColumn<Restore>> => [
      {
        Header: Messages.backupInventory.table.columns.status.name,
        accessor: 'status',
        options: [
          {
            label: Messages.backupInventory.table.columns.status.options.success,
            value: BackupStatus.BACKUP_STATUS_SUCCESS,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.error,
            value: BackupStatus.BACKUP_STATUS_ERROR,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.pending,
            value: BackupStatus.BACKUP_STATUS_PENDING,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.paused,
            value: BackupStatus.BACKUP_STATUS_PAUSED,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.invalid,
            value: BackupStatus.BACKUP_STATUS_INVALID,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.inProgress,
            value: BackupStatus.BACKUP_STATUS_IN_PROGRESS,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.failedToDelete,
            value: BackupStatus.BACKUP_STATUS_FAILED_TO_DELETE,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.failedNotSupportedByAgent,
            value: BackupStatus.BACKUP_STATUS_FAILED_NOT_SUPPORTED_BY_AGENT,
          },
          {
            label: Messages.backupInventory.table.columns.status.options.deleting,
            value: BackupStatus.BACKUP_STATUS_DELETING,
          },
        ],
        type: FilterFieldTypes.DROPDOWN,
        Cell: ({ value, row }) => (
          <Status
            showLogsAction={row.original.vendor === Databases.mongodb}
            status={value}
            onLogClick={() => onLogClick(row.original)}
          />
        ),
        width: '100px',
      },
      {
        Header: Messages.backupInventory.table.columns.name,
        accessor: 'name',
        id: 'name',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.backupInventory.table.columns.vendor,
        accessor: ({ vendor }: Restore) => DATABASE_LABELS[vendor],
        width: '150px',
        type: FilterFieldTypes.DROPDOWN,
        options: [
          {
            label: 'MongoDB',
            value: DATABASE_LABELS.mongodb,
          },
          {
            label: 'HaProxy',
            value: DATABASE_LABELS.haproxy,
          },
          {
            label: 'MariaDB',
            value: DATABASE_LABELS.mariadb,
          },
          {
            label: 'MySQL',
            value: DATABASE_LABELS.mysql,
          },
          {
            label: 'PostgresSQL',
            value: DATABASE_LABELS.postgresql,
          },
          {
            label: 'ProxySQL',
            value: DATABASE_LABELS.proxysql,
          },
        ],
      },
      {
        Header: Messages.restoreHistory.table.columns.started,
        accessor: 'started',
        Cell: ({ value }) => <DetailedDate dataTestId="restore-started" date={value} />,
        width: '200px',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.restoreHistory.table.columns.finished,
        accessor: 'finished',
        Cell: ({ value }) => (value ? <DetailedDate dataTestId="restore-finished" date={value} /> : null),
        width: '200px',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.restoreHistory.table.columns.targetService,
        accessor: 'serviceName',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.backupInventory.table.columns.location,
        accessor: 'locationName',
        type: FilterFieldTypes.DROPDOWN,
        options: locations.map((item) => ({
          label: item.name,
          value: item.name,
        })),
        Cell: ({ row, value }) => (
          <span>
            {value} ({locationsByLocationId[row.original.locationId]?.type})
          </span>
        ),
      },
      {
        Header: Messages.restoreHistory.table.columns.actions,
        accessor: 'id',
        width: '100px',
        type: FilterFieldTypes.TEXT,
        Cell: ({ row }) => <RestoreHistoryActions row={row} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationsByLocationId, locations]
  );

  const renderSelectedSubRow = React.useCallback(
    (row: Row<Restore>) => (
      <RestoreHistoryDetails
        name={row.original.name}
        pitrTimestamp={row.original.pitrTimestamp}
        dataModel={row.original.dataModel}
      />
    ),
    []
  );

  const handleLogsClose = () => {
    setSelectedRestore(null);
    setLogsModalVisible(false);
  };

  const onLogClick = (restore: Restore) => {
    setSelectedRestore(restore);
    setLogsModalVisible(true);
  };

  const getLogs = useCallback(
    async (startingChunk: number, offset: number, token?: CancelToken) =>
      RestoreHistoryService.getLogs(selectedRestore!.artifactId, startingChunk, offset, token),
    [selectedRestore]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);

  useEffect(() => {
    const getData = async (showLoading = false) => {
      showLoading && setPending(true);
      await dispatch(fetchStorageLocations());

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
    <Page navId="restore-history">
      <Page.Contents>
        <FeatureLoader featureName={Messages.backupManagement} featureSelector={featureSelector}>
          <Table
            columns={columns}
            data={data}
            totalItems={data.length}
            emptyMessage={Messages.restoreHistory.table.noData}
            pendingRequest={pending}
            autoResetExpanded={false}
            renderExpandedRow={renderSelectedSubRow}
            getRowId={useCallback((row: Restore) => row.id, [])}
            showFilter
          />
          {logsModalVisible && (
            <RestoreLogsModal
              title={Messages.backupInventory.getLogsTitle(selectedRestore?.name || '')}
              isVisible
              onClose={handleLogsClose}
              getLogChunks={getLogs}
            />
          )}
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default RestoreHistory;
