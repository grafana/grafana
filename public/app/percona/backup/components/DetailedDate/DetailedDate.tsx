import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import moment from 'moment/moment';
import { DetailedDateProps } from './DetailedDate.types';
import { getStyles } from './DetailedDate.styles';
import { DAY_FORMAT, HOUR_FORMAT } from './DetailedDate.constants';

export const DetailedDate: FC<DetailedDateProps> = ({
  date,
  dayFormat = DAY_FORMAT,
  hourFormat = HOUR_FORMAT,
  dataQa = 'detailed-date',
  className,
}) => {
  const styles = useStyles(getStyles);
  const momentObj = moment(date);
  const dayTime = momentObj.format(dayFormat);
  const hourTime = momentObj.format(hourFormat);

  return (
    <span data-qa={dataQa} className={className}>
      <span>{dayTime}</span>
      <span className={styles.hourWrapper}>{hourTime}</span>
    </span>
  );
};
