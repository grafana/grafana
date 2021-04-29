import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { DBIcon } from '../../DBIcon';
import { BackupInventoryActionsProps } from './RestoreHistoryActions.types';
import { getStyles } from './RestoreHistoryActions.styles';
import { Messages } from './RestoreHistoryActions.messages';

export const RestoreHistoryActions: FC<BackupInventoryActionsProps> = ({ restore, onCancel, onRestore, onDelete }) => {
  const styles = useStyles(getStyles);
  const handleCancel = () => onCancel(restore);
  const handleRestore = () => onRestore(restore);
  const handleDelete = () => onDelete(restore);

  return (
    <div className={styles.actionsWrapper}>
      <DBIcon
        tooltipText={Messages.cancelRestore}
        type="cancel"
        data-qa="restore-backup-artifact-button"
        role="button"
        onClick={handleCancel}
      />
      <DBIcon
        tooltipText={Messages.repeatRestore}
        type="restore"
        data-qa="restore-button"
        role="button"
        onClick={handleRestore}
      />
      <DBIcon
        tooltipText={Messages.deleteRestore}
        type="delete"
        data-qa="restore-backup-artifact-button"
        role="button"
        onClick={handleDelete}
      />
    </div>
  );
};
