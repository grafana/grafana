import React, { FC, useMemo, useState, useEffect } from 'react';
import { Column, Row } from 'react-table';
import { Button, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { ExpandableCell } from 'app/percona/shared/components/Elements/ExpandableCell/ExpandableCell';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { AddBackupModal } from './AddBackupModal';
import { AddBackupFormProps } from './AddBackupModal/AddBackupModal.types';
import { Status } from '../Status';
import { BackupInventoryActions } from './BackupInventoryActions';
import { DetailedDate } from '../DetailedDate';
import { Messages } from '../../Backup.messages';
import { Backup } from './BackupInventory.types';
import { BackupInventoryService } from './BackupInventory.service';
import { RestoreBackupModal } from './RestoreBackupModal';
import { getStyles } from './BackupInventory.styles';
import { useRecurringCall } from '../../hooks/recurringCall.hook';
import {
  BACKUP_CANCEL_TOKEN,
  LIST_ARTIFACTS_CANCEL_TOKEN,
  RESTORE_CANCEL_TOKEN,
  DATA_INTERVAL,
} from './BackupInventory.constants';
import { DeleteModal } from 'app/percona/shared/components/Elements/DeleteModal';

export const BackupInventory: FC = () => {
  const [pending, setPending] = useState(true);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [data, setData] = useState<Backup[]>([]);
  const [triggerTimeout] = useRecurringCall();
  const [generateToken] = useCancelToken();
  const columns = useMemo(
    (): Column[] => [
      {
        Header: Messages.backupInventory.table.columns.name,
        accessor: 'name',
        id: 'name',
        width: '250px',
        Cell: ({ row, value }) => <ExpandableCell row={row} value={value} />,
      },
      {
        Header: Messages.backupInventory.table.columns.vendor,
        accessor: ({ vendor }: Backup) => DATABASE_LABELS[vendor],
        width: '150px',
      },
      {
        Header: Messages.backupInventory.table.columns.created,
        accessor: 'created',
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
      {
        Header: Messages.backupInventory.table.columns.actions,
        accessor: 'id',
        Cell: ({ row }) => (
          <BackupInventoryActions
            onRestore={onRestoreClick}
            onBackup={onBackupClick}
            backup={row.original as Backup}
            onDelete={onDeleteClick}
          />
        ),
        width: '150px',
      },
    ],
    []
  );
  const styles = useStyles(getStyles);

  const onRestoreClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setRestoreModalVisible(true);
  };

  const onDeleteClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setDeleteModalVisible(true);
  };

  const handleClose = () => {
    setSelectedBackup(null);
    setRestoreModalVisible(false);
    setBackupModalVisible(false);
  };

  const handleRestore = async (serviceId: string, artifactId: string) => {
    try {
      await BackupInventoryService.restore(serviceId, artifactId, generateToken(RESTORE_CANCEL_TOKEN));
      setRestoreModalVisible(false);
    } catch (e) {
      logger.error(e);
    }
  };

  const handleDelete = async (force = false) => {
    try {
      await BackupInventoryService.delete(selectedBackup!.id, force);
      setDeleteModalVisible(false);
      setSelectedBackup(null);
      getData(true);
    } catch (e) {
      logger.error(e);
    }
  };

  const getData = async (showLoading = false) => {
    showLoading && setPending(true);

    try {
      const backups = await BackupInventoryService.list(generateToken(LIST_ARTIFACTS_CANCEL_TOKEN));
      setData(backups);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPending(false);
  };

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
    setSelectedBackup(backup);
    setBackupModalVisible(true);
  };

  const handleBackup = async ({ service, location, backupName, description }: AddBackupFormProps) => {
    try {
      await BackupInventoryService.backup(
        service.value?.id || '',
        location.value || '',
        backupName,
        description,
        generateToken(BACKUP_CANCEL_TOKEN)
      );
      setBackupModalVisible(false);
      setSelectedBackup(null);
      getData(true);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
  };

  useEffect(() => {
    getData(true).then(() => triggerTimeout(getData, DATA_INTERVAL));
  }, []);

  return (
    <>
      <div className={styles.addWrapper}>
        <Button
          size="md"
          icon="plus-square"
          variant="link"
          data-qa="backup-add-modal-button"
          onClick={() => onBackupClick(null)}
        >
          {Messages.add}
        </Button>
      </div>
      <Table
        data={data}
        totalItems={data.length}
        columns={columns}
        emptyMessage={Messages.backupInventory.table.noData}
        pendingRequest={pending}
        autoResetExpanded={false}
        renderExpandedRow={renderSelectedSubRow}
      ></Table>
      <RestoreBackupModal
        backup={selectedBackup}
        isVisible={restoreModalVisible}
        onClose={handleClose}
        onRestore={handleRestore}
        noService={!selectedBackup?.serviceId || !selectedBackup?.serviceName}
      />
      <AddBackupModal
        backup={selectedBackup}
        isVisible={backupModalVisible}
        onClose={handleClose}
        onBackup={handleBackup}
      />
      <DeleteModal
        title={Messages.backupInventory.deleteModalTitle}
        message={Messages.backupInventory.getDeleteMessage(selectedBackup?.name || '')}
        isVisible={deleteModalVisible}
        setVisible={setDeleteModalVisible}
        forceLabel={Messages.backupInventory.deleteFromStorage}
        onDelete={handleDelete}
        initialForceValue={true}
        showForce
      />
    </>
  );
};
