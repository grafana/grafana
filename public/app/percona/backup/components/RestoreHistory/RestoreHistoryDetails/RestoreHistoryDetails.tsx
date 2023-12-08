import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';
import { formatDataModel } from 'app/percona/backup/Backup.utils';

import { DetailedDate } from '../../DetailedDate';

import { Messages } from './RestoreHistoryDetails.Messages';
import { getStyles } from './RestoreHistoryDetails.styles';
import { RestoreHistoryDetailsProps } from './RestoreHistoryDetails.types';

export const RestoreHistoryDetails: FC<RestoreHistoryDetailsProps> = ({ name, dataModel, pitrTimestamp }) => {
  const styles = useStyles(getStyles);
  const dataModelMsg = formatDataModel(dataModel);

  return (
    <div className={styles.detailsWrapper} data-testid="restore-details-wrapper">
      <span data-testid="restore-details-name">
        <span className={styles.detailLabel}>{Messages.backupName}</span> <span>{name}</span>
      </span>
      <span data-testid="restore-details-data-model">
        <span className={styles.detailLabel}>{Messages.dataModel}</span> <span>{dataModelMsg}</span>
      </span>
      {pitrTimestamp ? (
        <span className={styles.pitrContainer} data-testid="restore-details-pitr">
          <span className={styles.detailLabel}>{Messages.pitr}</span>
          <DetailedDate date={pitrTimestamp} dataTestId="restore-details-date" />
        </span>
      ) : null}
    </div>
  );
};
