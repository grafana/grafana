import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';
import { DetailedDate } from '../../DetailedDate';
import { RestoreHistoryDetailsProps } from './RestoreHistoryDetails.types';
import { Messages } from './RestoreHistoryDetails.Messages';
import { getStyles } from './RestoreHistoryDetails.styles';

export const RestoreHistoryDetails: FC<RestoreHistoryDetailsProps> = ({ name, finished, dataModel }) => {
  const styles = useStyles(getStyles);
  const dataModelMsg = formatDataModel(dataModel);

  return (
    <div className={styles.detailsWrapper} data-qa="restore-details-wrapper">
      <span data-qa="restore-details-name">
        <span className={styles.detailLabel}>{Messages.backupName}</span> <span>{name}</span>
      </span>
      <span data-qa="restore-details-finished">
        <span className={styles.detailLabel}>{Messages.finished}</span>
        <DetailedDate dataQa="restore-details-finished" date={finished} />
      </span>
      <span data-qa="restore-details-data-model">
        <span className={styles.detailLabel}>{Messages.dataModel}</span> <span>{dataModelMsg}</span>
      </span>
    </div>
  );
};
