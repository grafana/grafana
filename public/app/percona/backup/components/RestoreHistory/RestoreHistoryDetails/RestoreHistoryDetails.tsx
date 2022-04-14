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
    <div className={styles.detailsWrapper} data-testid="restore-details-wrapper">
      <span data-testid="restore-details-name">
        <span className={styles.detailLabel}>{Messages.backupName}</span> <span>{name}</span>
      </span>
      {finished ? (
        <span data-testid="restore-details-finished">
          <span className={styles.detailLabel}>{Messages.finished}</span>
          <DetailedDate date={finished} dataTestId="restore-details-date" />
        </span>
      ) : null}
      <span data-testid="restore-details-data-model">
        <span className={styles.detailLabel}>{Messages.dataModel}</span> <span>{dataModelMsg}</span>
      </span>
    </div>
  );
};
