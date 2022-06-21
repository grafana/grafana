import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';

import { Status } from '../../Status';

import { Messages } from './BackupInventoryDetails.messages';
import { getStyles } from './BackupInventoryDetails.styles';
import { BackupInventoryDetailsProps } from './BackupInventoryDetails.types';

export const BackupInventoryDetails: FC<BackupInventoryDetailsProps> = ({ name, status, dataModel }) => {
  const styles = useStyles(getStyles);
  const dataModelMsg = formatDataModel(dataModel);

  return (
    <div className={styles.detailsWrapper} data-qa="backup-artifact-details-wrapper">
      <span data-qa="backup-artifact-details-name">
        <span className={styles.detailLabel}>{Messages.backupName}</span> <span>{name}</span>
      </span>
      <span data-qa="backup-artifact-details-status">
        <span className={styles.detailLabel}>{Messages.testResuts}</span> <Status status={status} />
      </span>
      <span data-qa="backup-artifact-details-data-model">
        <span className={styles.detailLabel}>{Messages.dataModel}</span> <span>{dataModelMsg}</span>
      </span>
    </div>
  );
};
