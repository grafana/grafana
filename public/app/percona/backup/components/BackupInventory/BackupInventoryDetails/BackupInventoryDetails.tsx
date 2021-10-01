import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { BackupInventoryDetailsProps } from './BackupInventoryDetails.types';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { Messages } from './BackupInventoryDetails.messages';
import { getStyles } from './BackupInventoryDetails.styles';

export const BackupInventoryDetails: FC<BackupInventoryDetailsProps> = ({ name, status, dataModel }) => {
  const styles = useStyles(getStyles);
  const dataModelMsg = formatDataModel(dataModel);

  return (
    <div className={styles.detailsWrapper} data-testid="backup-artifact-details-wrapper">
      <span data-testid="backup-artifact-details-name">
        <span className={styles.detailLabel}>{Messages.backupName}</span> <span>{name}</span>
      </span>
      <span data-testid="backup-artifact-details-data-model">
        <span className={styles.detailLabel}>{Messages.dataModel}</span> <span>{dataModelMsg}</span>
      </span>
    </div>
  );
};
