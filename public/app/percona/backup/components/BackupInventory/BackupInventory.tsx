/* eslint-disable react/display-name */
import { logger } from '@percona/platform-core';
import { CancelToken } from 'axios';
import React, { FC, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Column, Row } from 'react-table';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { ApiVerboseError, Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backupLocations';
import { getBackupLocations, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { apiErrorParser, isApiCancelError } from 'app/percona/shared/helpers/api';
import { useAppDispatch } from 'app/store/store';

import { NEW_BACKUP_URL } from '../../Backup.constants';
import { Messages } from '../../Backup.messages';
import { formatBackupMode } from '../../Backup.utils';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import { DetailedDate } from '../DetailedDate';
import { Status } from '../Status';
import { LocationType, StorageLocation } from '../StorageLocations/StorageLocations.types';

import { LIST_ARTIFACTS_CANCEL_TOKEN, RESTORE_CANCEL_TOKEN, DATA_INTERVAL } from './BackupInventory.constants';
import { BackupInventoryService } from './BackupInventory.service';
import { getStyles } from './BackupInventory.styles';
import { Backup } from './BackupInventory.types';
import { BackupInventoryActions } from './BackupInventoryActions';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { BackupLogsModal } from './BackupLogsModal/BackupLogsModal';
import { RestoreBackupModal } from './RestoreBackupModal';

export const BackupInventory: FC = () => {
  const [pending, setPending] = useState(true);
  const [deletePending, setDeletePending] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [data, setData] = useState<Backup[]>([]);
  const dispatch = useAppDispatch();
  const [restoreErrors, setRestoreErrors] = useState<ApiVerboseError[]>([]);
  const backupLocationMap = useRef<Record<string, StorageLocation | undefined>>({});
  const navModel = usePerconaNavModel('backup-inventory');
  const [triggerTimeout] = useRecurringCall();
  const [generateToken] = useCancelToken();
  const { result: locations = [] } = useSelector(getBackupLocations);

  const columns = useMemo(
    (): Array<Column<Backup>> => [
      {
        Header: Messages.backupInventory.table.columns.status,
        accessor: 'status',
        width: '100px',
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
      },
      {
        Header: Messages.backupInventory.table.columns.service,
        accessor: 'serviceName',
      },
      {
        Header: Messages.backupInventory.table.columns.vendor,
        accessor: ({ vendor }: Backup) => DATABASE_LABELS[vendor],
        width: '150px',
      },
      {
        Header: Messages.backupInventory.table.columns.created,
        accessor: 'created',
        width: '200px',
        Cell: ({ value }) => <DetailedDate date={value} />,
      },
      {
        Header: Messages.backupInventory.table.columns.type,
        accessor: 'mode',
        Cell: ({ value }) => formatBackupMode(value),
      },
      {
        Header: Messages.backupInventory.table.columns.location,
        accessor: 'locationName',
        width: '250px',
      },
      {
        Header: Messages.backupInventory.table.columns.actions,
        accessor: 'id',
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
    []
  );
  const styles = useStyles2(getStyles);

  const onRestoreClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setRestoreModalVisible(true);
  };

  const onDeleteClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setDeleteModalVisible(true);
  };

  const onLogClick = (backup: Backup) => {
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

        backups.forEach((backup) => {
          if (!backupLocationMap.current[backup.id]) {
            backupLocationMap.current[backup.id] = locations.find(
              (location) => location.locationID === backup.locationId
            );
          }
        });
        setData(backups);
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
    (row: Row<Backup>) => (
      <BackupInventoryDetails
        name={row.original.name}
        status={row.original.status}
        dataModel={row.original.dataModel}
      />
    ),
    []
  );

  const onBackupClick = (backup: Backup | null) => {
    if (backup) {
      locationService.push(`/backup${backup.id}/edit`);
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
    <OldPage navModel={navModel}>
      <OldPage.Contents>
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
            getRowId={useCallback((row: Backup) => row.id, [])}
          ></Table>
          {restoreModalVisible && (
            <RestoreBackupModal
              backup={selectedBackup}
              location={selectedBackup ? backupLocationMap.current[selectedBackup.id] : undefined}
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
              showForce={!!selectedBackup && backupLocationMap.current[selectedBackup.id]?.type !== LocationType.CLIENT}
            >
              {!!selectedBackup && backupLocationMap.current[selectedBackup.id]?.type === LocationType.CLIENT && (
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
      </OldPage.Contents>
    </OldPage>
  );
};

export default BackupInventory;
