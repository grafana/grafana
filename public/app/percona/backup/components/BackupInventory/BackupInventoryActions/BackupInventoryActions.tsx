import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { DBIcon } from '../../DBIcon';
import { BackupStatus } from 'app/percona/backup/Backup.types';
import { BackupInventoryActionsProps } from './BackupInventoryActions.types';
import { getStyles } from './BackupInventoryActions.styles';
import { Messages } from './BackupInventoryActions.messages';

export const BackupInventoryActions: FC<BackupInventoryActionsProps> = ({ backup, onRestore, onBackup, onDelete }) => {
  const styles = useStyles(getStyles);
  const handeClick = () => onRestore(backup);
  const handleBackup = () => onBackup(backup);
  // const handleDelete = () => onDelete(backup);

  return (
    <div className={styles.actionsWrapper}>
      <DBIcon
        tooltipText={Messages.restoreBackup}
        type="restore"
        disabled={backup.status !== BackupStatus.BACKUP_STATUS_SUCCESS}
        data-qa="restore-backup-artifact-button"
        role="button"
        onClick={handeClick}
      />
      <DBIcon
        tooltipText={Messages.addBackup}
        type="backup"
        data-qa="restore-backup-artifact-button"
        role="button"
        onClick={handleBackup}
      />
      {/* <DBIcon
        tooltipText={Messages.deleteBackup}
        type="delete"
        disabled={
          backup.status === BackupStatus.BACKUP_STATUS_IN_PROGRESS ||
          backup.status === BackupStatus.BACKUP_STATUS_PENDING ||
          backup.status === BackupStatus.BACKUP_STATUS_DELETING
        }
        data-qa="delete-backup-artifact-button"
        role="button"
        onClick={handleDelete}
      /> */}
    </div>
  );
};
