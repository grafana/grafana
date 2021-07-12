import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { ScheduledBackupDetailsProps } from './ScheduledBackupsDetails.types';
import { Messages } from './ScheduledBackupsDetails.messages';
import { getStyles } from './ScheduledBackupsDetails.styles';
import { DescriptionBlock } from '../../DescriptionBlock';

export const ScheduledBackupDetails: FC<ScheduledBackupDetailsProps> = ({
  name,
  description,
  dataModel,
  cronExpression,
}) => {
  const styles = useStyles(getStyles);
  const dataModelMsg = formatDataModel(dataModel);

  return (
    <div className={styles.detailsWrapper} data-qa="scheduled-backup-details-wrapper">
      <span data-qa="scheduled-backup-details-name">
        <span className={styles.detailLabel}>{Messages.backupName}</span> <span>{name}</span>
      </span>
      <DescriptionBlock description={description} dataQa="scheduled-backup-details-description" />
      <span data-qa="scheduled-backup-details-data-model">
        <span className={styles.detailLabel}>{Messages.dataModel}</span> <span>{dataModelMsg}</span>
      </span>
      <span data-qa="scheduled-backup-details-cron">
        <span className={styles.detailLabel}>{Messages.cronExpression}</span> <span>{cronExpression}</span>
      </span>
    </div>
  );
};
