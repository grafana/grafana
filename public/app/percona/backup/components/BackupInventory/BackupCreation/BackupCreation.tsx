import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import moment from 'moment/moment';
import { BackupCreationProps } from './BackupCreation.types';
import { getStyles } from './BackupCreation.styles';
import { DAY_FORMAT, HOUR_FORMAT } from './BackupCreation.constants';

export const BackupCreation: FC<BackupCreationProps> = ({ date }) => {
  const styles = useStyles(getStyles);
  const momentObj = moment(date);
  const dayTime = momentObj.format(DAY_FORMAT);
  const hourTime = momentObj.format(HOUR_FORMAT);

  return (
    <div data-qa="backup-creation">
      <span>{dayTime}</span>
      <span className={styles.hourWrapper}>{hourTime}</span>
    </div>
  );
};
