import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { DBIcon } from '../../DBIcon';

import { Messages } from './BackupInventoryActions.messages';
import { getStyles } from './BackupInventoryActions.styles';
import { BackupInventoryActionsProps } from './BackupInventoryActions.types';

export const BackupInventoryActions: FC<BackupInventoryActionsProps> = ({ backup, onBackup }) => {
  const styles = useStyles(getStyles);
  const handleBackup = () => onBackup(backup);

  return (
    <div className={styles.actionsWrapper}>
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
