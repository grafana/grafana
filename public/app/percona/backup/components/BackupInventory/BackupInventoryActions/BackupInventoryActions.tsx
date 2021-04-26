import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { DBIcon } from '../../DBIcon';
import { Status } from '../BackupInventory.types';
import { BackupInventoryActionsProps } from './BackupInventoryActions.types';
import { getStyles } from './BackupInventoryActions.styles';
import { Messages } from './BackupInventoryActions.messages';

export const BackupInventoryActions: FC<BackupInventoryActionsProps> = ({ backup, onRestore, onBackup }) => {
  const styles = useStyles(getStyles);
  const handeClick = () => onRestore(backup);
  const handleBackup = () => onBackup(backup);

  return (
    <div className={styles.actionsWrapper}>
      <DBIcon
        tooltipText={Messages.restoreBackup}
        type="restore"
        disabled={backup.status !== Status.SUCCESS}
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
    </div>
  );
};
