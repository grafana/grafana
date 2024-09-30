/* eslint-disable react/display-name */
import { CancelToken } from 'axios';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Row } from 'react-table';

import { AppEvents, SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { BackupStatus } from 'app/percona/backup/Backup.types';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { ApiVerboseError, Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backups/backupLocations';
import { getBackupLocations, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { apiErrorParser, isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { NEW_BACKUP_URL, RESTORES_URL } from '../../Backup.constants';
import { Messages } from '../../Backup.messages';
import { BackupModeMap, formatBackupMode } from '../../Backup.utils';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { DetailedDate } from '../DetailedDate';
import { Status } from '../Status';
import { LocationType } from '../StorageLocations/StorageLocations.types';

import { DATA_INTERVAL, LIST_ARTIFACTS_CANCEL_TOKEN, RESTORE_CANCEL_TOKEN } from './BackupInventory.constants';
import { BackupInventoryService } from './BackupInventory.service';
import { getStyles } from './BackupInventory.styles';
import { BackupRow } from './BackupInventory.types';
import { BackupInventoryActions } from './BackupInventoryActions';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { BackupLogsModal } from './BackupLogsModal/BackupLogsModal';
import { RestoreBackupModal } from './RestoreBackupModal';

export const BackupInventory: FC = () => {
  const [pending, setPending] = useState(true);
  const [deletePending, setDeletePending] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRow | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [data, setData] = useState<BackupRow[]>([]);
  const [serviceModes, setServiceModes] = useState<Array<SelectableValue<string>>>([]);
  const dispatch = useAppDispatch();
  const [restoreErrors, setRestoreErrors] = useState<ApiVerboseError[]>([]);
  const [triggerTimeout] = useRecurringCall();
  const [generateToken] = useCancelToken();
  const { result: locations = [] } = useSelector(getBackupLocations);

  const columns = useMemo(
    (): Array<ExtendedColumn<BackupRow>> => [
      {
        Header: Messages.backupInventory.table.columns.status.name,
        accessor: 'status',
        type: FilterFieldTypes.DROPDOWN,
        width: '100px',
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
        Cell: ({ value, row }) => (
          <Status
            showLogsAction={row.original.vendor === Databases.mongodb}
            status={value}
            onLogClick={() => onLogClick(row.original)}
          />
        ),
      },
      {
        Header: Messages.backupInventory.table.columns.name,
        accessor: 'name',
        id: 'name',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.backupInventory.table.columns.service,
        accessor: 'serviceName',
        type: FilterFieldTypes.DROPDOWN,
        options: serviceModes,
      },
      {
        Header: Messages.scheduledBackups.table.columns.vendor,
        accessor: 'vendor',
        width: '150px',
        Cell: ({ value }) => DATABASE_LABELS[value],
        type: FilterFieldTypes.DROPDOWN,
        options: Object.values(DATABASE_LABELS).map((item: string) => ({
          label: item,
          value: item,
        })),
      },
      {
        Header: Messages.backupInventory.table.columns.created,
        accessor: 'created',
        width: '200px',
        type: FilterFieldTypes.TEXT,
        Cell: ({ value }) => <DetailedDate date={value} />,
      },
      {
        Header: Messages.backupInventory.table.columns.type,
        accessor: 'mode',
        type: FilterFieldTypes.DROPDOWN,
        Cell: ({ value }) => formatBackupMode(value),
        options: Object.entries(BackupModeMap).map(([key, value]) => ({
          label: value,
          value: key,
        })),
      },
      {
        Header: Messages.backupInventory.table.columns.location,
        accessor: 'locationName',
        type: FilterFieldTypes.TEXT,
        width: '250px',
        Cell: ({ row, value }) => (
          <span>
            {value} ({row.original.location?.type})
          </span>
        ),
      },
      {
        Header: Messages.backupInventory.table.columns.actions,
        accessor: 'id',
        type: FilterFieldTypes.TEXT,
        Cell: ({ row }) => (
          <BackupInventoryActions
            row={row}
            onRestore={onRestoreClick}
            onBackup={onBackupClick}
            backup={row.original}
            onDelete={onDeleteClick}
          />
        ),
        width: '100px',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceModes]
  );
  const styles = useStyles2(getStyles);

  const onRestoreClick = (backup: BackupRow) => {
    setSelectedBackup(backup);
    setRestoreModalVisible(true);
  };

  const onDeleteClick = (backup: BackupRow) => {
    setSelectedBackup(backup);
    setDeleteModalVisible(true);
  };

  const onLogClick = (backup: BackupRow) => {
    setSelectedBackup(backup);
    setLogsModalVisible(true);
  };

  const handleClose = () => {
    setRestoreModalVisible(false);
    setSelectedBackup(null);
    setRestoreErrors([]);
  };

  const handleLogsClose = () => {
    setSelectedBackup(null);
    setLogsModalVisible(false);
  };

  const handleRestore = async (serviceId: string, artifactId: string, pitrTimestamp?: string) => {
    try {
      await BackupInventoryService.restore(serviceId, artifactId, pitrTimestamp, generateToken(RESTORE_CANCEL_TOKEN));
      setRestoreErrors([]);
      setRestoreModalVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [Messages.backupInventory.restoreStarted]);
      locationService.push(RESTORES_URL);
    } catch (e) {
      setRestoreErrors(apiErrorParser(e));
      logger.error(e);
    }
  };

  const getData = useCallback(
    async (showLoading = false) => {
      showLoading && setPending(true);

      try {
        const backups = await BackupInventoryService.list(generateToken(LIST_ARTIFACTS_CANCEL_TOKEN));
        const backupsWithLocation = backups.map<BackupRow>((backup) => ({
          ...backup,
          location: locations.find((location) => location.locationID === backup.locationId),
        }));

        setData(backupsWithLocation);

        setServiceModes(
          backups.map((item) => ({
            label: item.serviceName,
            value: item.serviceName,
          }))
        );
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      }
      setPending(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations]
  );

  const handleDelete = useCallback(
    async (force = false) => {
      try {
        setDeletePending(true);
        await BackupInventoryService.delete(selectedBackup!.id, force);
        setDeleteModalVisible(false);
        setSelectedBackup(null);
        appEvents.emit(AppEvents.alertSuccess, [Messages.backupInventory.getDeleteSuccess(selectedBackup?.name ?? '')]);
        getData(true);
      } catch (e) {
        logger.error(e);
      } finally {
        setDeletePending(false);
      }
    },
    [getData, selectedBackup]
  );

  const getLogs = useCallback(
    async (startingChunk: number, offset: number, token?: CancelToken) => {
      return BackupInventoryService.getLogs(selectedBackup!.id, startingChunk, offset, token);
    },
    [selectedBackup]
  );

  const renderSelectedSubRow = React.useCallback(
    (row: Row<BackupRow>) => (
      <BackupInventoryDetails
        name={row.original.name}
        status={row.original.status}
        dataModel={row.original.dataModel}
        folder={row.original.folder}
      />
    ),
    []
  );

  const onBackupClick = (backup: BackupRow | null) => {
    if (backup) {
      locationService.push(`/backup/${backup.type}/${backup.id}/edit`);
    } else {
      locationService.push(NEW_BACKUP_URL);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('backupEnabled'), []);

  useEffect(() => {
    dispatch(fetchStorageLocations());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getData(true).then(() => triggerTimeout(getData, DATA_INTERVAL));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getData]);

  return (
    <Page navId="backup-inventory">
      <Page.Contents>
        <FeatureLoader featureName={Messages.backupManagement} featureSelector={featureSelector}>
          <div className={styles.addWrapper}>
            <LinkButton href={NEW_BACKUP_URL} size="md" variant="primary" data-testid="backup-add-button">
              {Messages.createNewBackup}
            </LinkButton>
          </div>
          <Table
            data={data}
            totalItems={data.length}
            columns={columns}
            emptyMessage={Messages.backupInventory.table.noData}
            pendingRequest={pending}
            autoResetExpanded={false}
            renderExpandedRow={renderSelectedSubRow}
            getRowId={useCallback((row: BackupRow) => row.id, [])}
            showFilter
          ></Table>
          {restoreModalVisible && (
            <RestoreBackupModal
              backup={selectedBackup}
              location={selectedBackup?.location}
              isVisible
              restoreErrors={restoreErrors}
              onClose={handleClose}
              onRestore={handleRestore}
              noService={!selectedBackup?.serviceId || !selectedBackup?.serviceName}
            />
          )}
          {deleteModalVisible && (
            <DeleteModal
              title={Messages.backupInventory.deleteModalTitle}
              message={Messages.backupInventory.getDeleteMessage(selectedBackup?.name || '')}
              isVisible
              setVisible={setDeleteModalVisible}
              forceLabel={Messages.backupInventory.deleteFromStorage}
              onDelete={handleDelete}
              initialForceValue={true}
              loading={deletePending}
              showForce={!!selectedBackup && selectedBackup.location?.type !== LocationType.CLIENT}
            >
              {!!selectedBackup && selectedBackup.location?.type === LocationType.CLIENT && (
                <Alert title="">{Messages.backupInventory.deleteWarning}</Alert>
              )}
            </DeleteModal>
          )}
          {logsModalVisible && (
            <BackupLogsModal
              title={Messages.backupInventory.getLogsTitle(selectedBackup?.name || '')}
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

export default BackupInventory;
