import React, { FC, useMemo, useState, useEffect } from 'react';
import { Column, Row } from 'react-table';
import { Button, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { DATABASE_LABELS } from 'app/percona/shared/core';
import { ExpandableCell } from 'app/percona/shared/components/Elements/ExpandableCell/ExpandableCell';
import { BackupInventoryDetails } from './BackupInventoryDetails';
import { AddBackupModal } from './AddBackupModal';
import { AddBackupFormProps } from './AddBackupModal/AddBackupModal.types';
import { Status } from './Status';
import { BackupInventoryActions } from './BackupInventoryActions';
import { BackupCreation } from './BackupCreation';
import { Messages } from './BackupInventory.messages';
import { Backup } from './BackupInventory.types';
import { BackupInventoryService } from './BackupInventory.service';
import { getStyles } from './BackupInventory.styles';

const { columns, noData } = Messages;
const { name, created, location, vendor, status, actions } = columns;

export const BackupInventory: FC = () => {
  const [pending, setPending] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [data, setData] = useState<Backup[]>([]);
  const columns = useMemo(
    (): Column[] => [
      {
        Header: name,
        accessor: 'name',
        id: 'name',
        width: '250px',
        Cell: ({ row, value }) => <ExpandableCell row={row} value={value} />,
      },
      {
        Header: vendor,
        accessor: ({ vendor }: Backup) => DATABASE_LABELS[vendor],
        width: '150px',
      },
      {
        Header: created,
        accessor: 'created',
        Cell: ({ value }) => <BackupCreation date={value} />,
      },
      {
        Header: location,
        accessor: 'locationName',
      },
      {
        Header: status,
        accessor: 'status',
        Cell: ({ value }) => <Status status={value} />,
      },
      {
        Header: actions,
        accessor: 'id',
        Cell: ({ row }) => <BackupInventoryActions onBackup={onBackupClick} backup={row.original as Backup} />,
        width: '80px',
      },
    ],
    []
  );
  const styles = useStyles(getStyles);

  const getData = async () => {
    setPending(true);

    try {
      const backups = await BackupInventoryService.list();
      setData(backups);
    } catch (e) {
      logger.error(e);
    } finally {
      setPending(false);
    }
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

  const handleClose = () => {
    setSelectedBackup(null);
    setBackupModalVisible(false);
  };

  const handleBackup = async ({ service, location, backupName, description }: AddBackupFormProps) => {
    try {
      await BackupInventoryService.backup(service.value?.id || '', location.value || '', backupName, description);
      setBackupModalVisible(false);
      setSelectedBackup(null);
      getData();
    } catch (e) {
      logger.error(e);
    }
  };

  useEffect(() => {
    getData();
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
        emptyMessage={noData}
        pendingRequest={pending}
        renderExpandedRow={renderSelectedSubRow}
      ></Table>
      <AddBackupModal
        backup={selectedBackup}
        isVisible={backupModalVisible}
        onClose={handleClose}
        onBackup={handleBackup}
      />
    </>
  );
};
