import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';
import { BackupStatus } from 'app/percona/backup/Backup.types';
import { Action, MultipleActions } from 'app/percona/dbaas/components/MultipleActions';
import { ExpandableRowButton } from 'app/percona/shared/components/Elements/ExpandableRowButton/ExpandableRowButton';

import { DBIcon } from '../../DBIcon';

import { Messages } from './BackupInventoryActions.messages';
import { getStyles } from './BackupInventoryActions.styles';
import { BackupInventoryActionsProps } from './BackupInventoryActions.types';

export const BackupInventoryActions: FC<BackupInventoryActionsProps> = ({
  row,
  backup,
  onRestore,
  onBackup,
  onDelete,
}) => {
  const styles = useStyles2(getStyles);
  const handeClick = () => onRestore(backup);
  // TODO uncomment when there's definition for this action
  // const handleBackup = () => onBackup(backup);
  const handleDelete = () => onDelete(backup);

  const getActions: Action[] = [
    {
      content: (
        <div className={styles.dropdownField}>
          <DBIcon type="restore" data-testid="restore-backup-artifact-button" role="button" />
          {Messages.restoreBackup}
        </div>
      ),
      disabled: backup.status !== BackupStatus.BACKUP_STATUS_SUCCESS,
      action: handeClick,
    },
    // {
    //   content: (
    //     <div className={styles.dropdownField}>
    //       <DBIcon type="backup" data-testid="add-backup-artifact-button" role="button" />
    //       {Messages.addBackup}
    //     </div>
    //   ),
    //   action: handleBackup,
    // },
    {
      content: (
        <div className={styles.dropdownField}>
          <DBIcon type="delete" data-testid="delete-backup-artifact-button" role="button" />
          {Messages.deleteBackup}
        </div>
      ),
      disabled:
        backup.status === BackupStatus.BACKUP_STATUS_IN_PROGRESS ||
        backup.status === BackupStatus.BACKUP_STATUS_PENDING ||
        backup.status === BackupStatus.BACKUP_STATUS_DELETING,
      action: handleDelete,
    },
  ];

  return (
    <div className={styles.actionsWrapper}>
      <MultipleActions actions={getActions} dataTestId="backup-inventory-actions" />
      <ExpandableRowButton row={row} />
    </div>
  );
};
