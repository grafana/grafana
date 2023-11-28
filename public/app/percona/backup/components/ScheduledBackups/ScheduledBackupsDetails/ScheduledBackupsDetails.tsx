import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';

import { DescriptionBlock } from '../../DescriptionBlock';

import { Messages } from './ScheduledBackupsDetails.messages';
import { getStyles } from './ScheduledBackupsDetails.styles';
import { ScheduledBackupDetailsProps } from './ScheduledBackupsDetails.types';

export const ScheduledBackupDetails: FC<React.PropsWithChildren<ScheduledBackupDetailsProps>> = ({
  name,
  description,
  dataModel,
  cronExpression,
  folder,
}) => {
  const styles = useStyles(getStyles);
  const dataModelMsg = formatDataModel(dataModel);

  return (
    <div className={styles.detailsWrapper} data-testid="scheduled-backup-details-wrapper">
      <span data-testid="scheduled-backup-details-name">
        <span className={styles.detailLabel}>{Messages.backupName}</span> <span>{name}</span>
      </span>
      {!!description && (
        <DescriptionBlock description={description} dataTestId="scheduled-backup-details-description" />
      )}
      <span data-testid="scheduled-backup-details-data-model">
        <span className={styles.detailLabel}>{Messages.dataModel}</span> <span>{dataModelMsg}</span>
      </span>
      <span data-testid="scheduled-backup-details-cron">
        <span className={styles.detailLabel}>{Messages.cronExpression}</span> <span>{cronExpression}</span>
      </span>
      {folder && (
        <span data-testid="scheduled-backup-details-folder">
          <span className={styles.detailLabel}>{Messages.folder}</span> <span>{folder}</span>
        </span>
      )}
    </div>
  );
};
